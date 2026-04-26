import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendLinePush, LineApiError } from "@/lib/line";

// ─── 送信スキップ条件（離脱・完全成約のみ） ─────────────────
const SKIP_STATUSES = new Set(["churned", "full_reversal_purchased"]);

// フォロー送信の最低間隔（ミリ秒）
const FOLLOW_UP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// デフォルトのフォローメッセージ本文
const DEFAULT_FOLLOW_BODY = "その後いかがですか？\n気になっていたのでご連絡しました。";

type Customer = {
  id:           number;
  status:       string;
  line_user_id: string | null;
};

type DbMessage = {
  customer_id: number;
  direction:   "inbound" | "outbound";
  created_at:  string;
};

type FollowResult = {
  customer_id: number;
  ok:          boolean;
  skipped?:    boolean;
  reason?:     string;
};

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function toErrorReason(e: unknown): string {
  if (e instanceof LineApiError) {
    return `line_api_error:${e.httpStatus} ${safeStringify(e.detail)}`;
  }
  if (e instanceof Error) return e.message;
  if (e !== null && typeof e === "object" && "message" in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === "string" && msg) return msg;
  }
  return safeStringify(e);
}

// ─── 1顧客のフォロー送信処理 ─────────────────────────────────
async function processCustomer(
  customer: Customer,
  now: Date,
  body: string,
): Promise<FollowResult> {
  const cid = customer.id;

  if (SKIP_STATUSES.has(customer.status)) {
    return { customer_id: cid, ok: true, skipped: true, reason: `skip_status:${customer.status}` };
  }
  if (!customer.line_user_id) {
    return { customer_id: cid, ok: false, skipped: true, reason: "no_line_user_id" };
  }

  // 直近メッセージを取得（outbound: 最終送信、inbound: 最終受信）
  const { data: msgs, error: msgError } = await supabase
    .from("messages")
    .select("customer_id, direction, created_at")
    .eq("customer_id", cid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (msgError) {
    return { customer_id: cid, ok: false, reason: `db_error:${msgError.message}` };
  }

  const rows = (msgs ?? []) as DbMessage[];
  const lastOutbound = rows.find((m) => m.direction === "outbound");
  const lastInbound  = rows.find((m) => m.direction === "inbound");

  if (!lastOutbound) {
    return { customer_id: cid, ok: true, skipped: true, reason: "no_outbound_yet" };
  }

  const lastSentAt = new Date(lastOutbound.created_at);
  const hoursSinceSent = (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60);

  // 24h 未経過は送信しない（サーバーサイド安全制限）
  if (now.getTime() - lastSentAt.getTime() < FOLLOW_UP_INTERVAL_MS) {
    return {
      customer_id: cid,
      ok:          true,
      skipped:     true,
      reason:      `too_soon:${hoursSinceSent.toFixed(1)}h`,
    };
  }

  // 最終送信後に受信がある場合はスキップ（返信あり）
  if (lastInbound && new Date(lastInbound.created_at) > lastSentAt) {
    return { customer_id: cid, ok: true, skipped: true, reason: "already_replied" };
  }

  // LINE 送信
  try {
    await sendLinePush(customer.line_user_id, body);
  } catch (e) {
    const reason = toErrorReason(e);
    console.error(`[follow-up] LINE送信失敗 customer_id=${cid}`, reason);
    return { customer_id: cid, ok: false, reason };
  }

  // messages に保存
  try {
    await supabase.from("messages").insert({
      customer_id: cid,
      source:      "follow_up",
      direction:   "outbound",
      text:        body,
    });
  } catch (e) {
    console.error(`[follow-up] DB保存失敗 customer_id=${cid}`, e);
    // LINE送信は成功しているのでokとして返す
  }

  return { customer_id: cid, ok: true };
}

// ─── 全顧客バッチ or 単一顧客の処理 ─────────────────────────
async function runProcess(targetCustomerId?: number, body = DEFAULT_FOLLOW_BODY) {
  const now = new Date();

  let customers: Customer[];

  if (targetCustomerId != null) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, status, line_user_id")
      .eq("id", targetCustomerId)
      .single();
    if (error || !data) throw new Error("顧客が見つかりません");
    customers = [data as Customer];
  } else {
    const { data, error } = await supabase
      .from("customers")
      .select("id, status, line_user_id");
    if (error) throw error;
    customers = ((data ?? []) as Customer[]).filter((c) => !!c.line_user_id);
  }

  const results: FollowResult[] = [];
  for (const c of customers) {
    const r = await processCustomer(c, now, body);
    results.push(r);
  }

  const sent    = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed  = results.filter((r) => !r.ok && !r.skipped).length;

  return { processed: results.length, sent, skipped, failed, results };
}

// ─── GET /api/follow-up/process （自動実行無効化済み）────
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: "自動実行は無効化されています。手動送信は POST を使用してください" },
    { status: 405 },
  );
}

// ─── POST /api/follow-up/process （手動トリガー）─────────────
export async function POST(req: NextRequest) {
  const reqBody = await req.json().catch(() => ({}));
  const customerId: number | undefined =
    typeof reqBody.customerId === "number" ? reqBody.customerId : undefined;
  const body: string =
    typeof reqBody.body === "string" && reqBody.body.trim()
      ? reqBody.body.trim()
      : DEFAULT_FOLLOW_BODY;

  try {
    const result = await runProcess(customerId, body);
    return NextResponse.json(result);
  } catch (e) {
    const reason = toErrorReason(e);
    console.error("[POST /api/follow-up/process]", reason);
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
