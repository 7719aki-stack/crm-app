import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendLinePush, LineApiError } from "@/lib/line";
import { markScheduleSent, cancelCustomerPendingSchedules } from "@/lib/educationScenario";

// ─── 停止条件 ─────────────────────────────────────────────
// これらのステータスに該当する顧客はシナリオ送信を停止し、
// 残りの pending スケジュールを全件キャンセルする。
const STOP_STATUSES = new Set([
  "paid_purchased",           // 有料鑑定購入済
  "info_received",            // 手動鑑定待ち（鑑定情報受領済み）
  "free_sent",                // 手動鑑定送信済
  "deep_guided",              // 深層誘導済（有料フェーズ入り）
  "destiny_proposed",         // アップセル提案以降
  "reversal_proposed",
  "deep_psych_proposed",
  "full_reversal_sounded",
  "full_reversal_purchased",
  "churned",                  // 離脱（cancelled 相当）
  "dormant",                  // 休眠
]);

// ─── 型定義 ──────────────────────────────────────────────
type Schedule = {
  id:           number;
  customer_id:  number;
  step_no:      number;
  message_body: string;
};

type Customer = {
  id:           number;
  status:       string;
  tags:         string;
  line_user_id: string | null;
};

type ProcessResult = {
  id:          number;
  customer_id: number;
  step_no:     number;
  ok:          boolean;
  skipped?:    boolean;
  reason?:     string;
};

function tokenFingerprint(token: string | undefined): string {
  if (!token) return "(未設定)";
  if (token.length < 12) return "(短すぎる)";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function toErrorReason(e: unknown): string {
  if (e instanceof LineApiError) {
    return `line_api_error:${e.httpStatus} ${safeStringify(e.detail)}`;
  }
  if (e instanceof Error) return e.message;
  // Supabase PostgrestError などの plain object で message を持つ場合
  if (e !== null && typeof e === "object" && "message" in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === "string" && msg) return msg;
  }
  return safeStringify(e);
}

// ─── メイン処理 ───────────────────────────────────────────
async function runProcess() {
  const now = new Date();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  console.log("[process] LINE token fingerprint:", tokenFingerprint(token));
  console.log("[process] VERCEL_ENV:", process.env.VERCEL_ENV ?? "(未設定)");

  // due スケジュールを取得
  const { data: rows, error } = await supabase
    .from("scenario_schedules")
    .select("id, customer_id, step_no, message_body")
    .eq("status",        "pending")
    .eq("scenario_type", "education")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) throw error;

  const schedules = (rows ?? []) as Schedule[];

  // 顧客情報をまとめて取得
  const customerIds = [...new Set(schedules.map((s) => s.customer_id))];
  const customerMap = new Map<number, Customer>();
  if (customerIds.length > 0) {
    const { data: custRows, error: custError } = await supabase
      .from("customers")
      .select("id, status, tags, line_user_id")
      .in("id", customerIds);
    if (custError) throw custError;
    for (const c of custRows ?? []) customerMap.set(c.id, c as Customer);
  }

  const results:           ProcessResult[] = [];
  const cancelledCustomers = new Set<number>();
  const targetUserIds:     string[] = [];

  for (const s of schedules) {
    const cust = customerMap.get(s.customer_id) ?? null;

    if (!cust) {
      results.push({ id: s.id, customer_id: s.customer_id, step_no: s.step_no, ok: false, reason: "customer_not_found" });
      continue;
    }

    // 手動停止フラグ（tags JSON 配列に "scenario_stop" が含まれる場合）
    const tags: string[] = (() => { try { return JSON.parse(cust.tags || "[]"); } catch { return []; } })();
    const isManualStop   = tags.includes("scenario_stop");

    // 停止条件チェック
    if (isManualStop || STOP_STATUSES.has(cust.status)) {
      const reason = isManualStop ? "manual_stop" : `stop_status:${cust.status}`;

      // 同一顧客の pending を一括キャンセル（初回のみ）
      if (!cancelledCustomers.has(s.customer_id)) {
        cancelledCustomers.add(s.customer_id);
        try {
          await cancelCustomerPendingSchedules(s.customer_id);
        } catch (e) {
          console.error(`[process] cancelCustomerPendingSchedules 失敗 customer_id=${s.customer_id}`, e);
        }
      }

      results.push({ id: s.id, customer_id: s.customer_id, step_no: s.step_no, ok: true, skipped: true, reason });
      continue;
    }

    // line_user_id 未設定 → pending のまま残して次回リトライ
    if (!cust.line_user_id) {
      console.warn(`[process] line_user_id なし customer_id=${s.customer_id} schedule.id=${s.id}`);
      results.push({ id: s.id, customer_id: s.customer_id, step_no: s.step_no, ok: false, reason: "no_line_user_id" });
      continue;
    }

    // LINE 送信
    try {
      console.log(`[process] LINE送信直前 schedule.id=${s.id} token fingerprint:`, tokenFingerprint(process.env.LINE_CHANNEL_ACCESS_TOKEN));
      if (!targetUserIds.includes(cust.line_user_id)) targetUserIds.push(cust.line_user_id);
      await sendLinePush(cust.line_user_id, s.message_body);
      await markScheduleSent(s.id);
      results.push({ id: s.id, customer_id: s.customer_id, step_no: s.step_no, ok: true });
    } catch (e) {
      // raw error をログ → Vercel Runtime Logs で型・内容を確認できる
      console.error(`[process] LINE送信失敗RAW schedule.id=${s.id}`, {
        errorType: Object.prototype.toString.call(e),
        isError: e instanceof Error,
        keys: e !== null && typeof e === "object" ? Object.keys(e) : null,
        raw: safeStringify(e),
      });
      const reason = toErrorReason(e);
      console.error(`[process] LINE送信失敗 schedule.id=${s.id} customer_id=${s.customer_id} reason=${reason}`);
      results.push({ id: s.id, customer_id: s.customer_id, step_no: s.step_no, ok: false, reason });
    }
  }

  const sent    = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed  = results.filter((r) => !r.ok).length;

  return {
    processed: results.length,
    sent,
    skipped,
    failed,
    results,
    debugVersion: "process-debug-v3",
    routeFile:    "src/app/api/scenario-schedules/process/route.ts",
    commitHint:   "toErrorReason-fix+debug-v3",
    debug: {
      tokenFingerprint: tokenFingerprint(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      apiUrl: "https://api.line.me/v2/bot/message/push",
      targetUserIds,
    },
  };
}

// ─── GET /api/scenario-schedules/process ─────────────────
// Vercel cron はこのエンドポイントを GET で呼び出す。
// CRON_SECRET が設定されている場合は Authorization ヘッダーを検証する。
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runProcess();
    console.log("[process cron]", JSON.stringify({ sent: result.sent, skipped: result.skipped, failed: result.failed }));
    return NextResponse.json(result);
  } catch (e) {
    const reason = toErrorReason(e);
    console.error("[GET /api/scenario-schedules/process]", reason, e);
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}

// ─── POST /api/scenario-schedules/process ─────────────────
// 手動トリガー・テスト用（認証不要）
export async function POST() {
  try {
    const result = await runProcess();
    return NextResponse.json(result);
  } catch (e) {
    const reason = toErrorReason(e);
    console.error("[POST /api/scenario-schedules/process]", reason, e);
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
