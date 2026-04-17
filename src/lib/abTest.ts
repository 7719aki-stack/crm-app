// ─── ABテスト分析エンジン（サーバー専用）────────────────────
// logs/reminder.log を解析して variant ごとの revenue_per_click を算出し、
// 勝者バリアントを決定する。勝者は Supabase の ab_results テーブルに永続化。
//
// ⚠️ このモジュールは Node.js の fs を使うため、
//    Server Component / API Route からのみ呼び出すこと。

import fs   from "fs";
import path from "path";
import { supabase } from "./db";

// ── 型定義 ──────────────────────────────────────────────

export type Variant = "A" | "B";

export interface VariantStats {
  variant:         Variant;
  clicks:          number;
  purchases:       number;
  totalAmount:     number;   // 売上合計（円）
  cvr:             number;   // 0–1 の小数
  revenuePerClick: number;   // 売上 / クリック数（収益最大化指標）
}

export interface ABResult {
  A:               VariantStats;
  B:               VariantStats;
  /** null = データ不足で判定不可（片方が MIN_CLICKS 未満） */
  winner:          Variant | null;
  winnerCVR:       number;
  winnerRPC:       number;   // 勝者の revenue_per_click
  totalClicks:     number;
  totalPurchases:  number;
  totalRevenue:    number;   // 全売上合計（円）
  overallCVR:      number;
}

// ── 定数 ────────────────────────────────────────────────

export const MIN_CLICKS_FOR_DECISION = 10;
const LOG_PATH = path.join(process.cwd(), "logs", "reminder.log");

// ── ログ解析 ────────────────────────────────────────────

interface LogEntry {
  event?:       string;      // "click" | "purchase" | undefined（旧フォーマット = click）
  customerId?:  number;
  variant?:     string;
  sendCount?:   number;
  clickedAt?:   string;      // 旧フォーマット互換
  purchasedAt?: string;
  price?:       number;      // 購入金額（purchase イベントのみ）
}

function parseLog(): {
  clicks:    Record<Variant, number>;
  purchases: Record<Variant, number>;
  revenue:   Record<Variant, number>;
} {
  const result = {
    clicks:    { A: 0, B: 0 } as Record<Variant, number>,
    purchases: { A: 0, B: 0 } as Record<Variant, number>,
    revenue:   { A: 0, B: 0 } as Record<Variant, number>,
  };

  if (!fs.existsSync(LOG_PATH)) return result;

  const lines = fs.readFileSync(LOG_PATH, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      const v = entry.variant as Variant | undefined;
      if (v !== "A" && v !== "B") continue;

      // event フィールドがない旧エントリは click として扱う
      const ev = entry.event ?? (entry.clickedAt ? "click" : null);
      if (ev === "click") {
        result.clicks[v]++;
      } else if (ev === "purchase") {
        result.purchases[v]++;
        result.revenue[v] += typeof entry.price === "number" ? entry.price : 0;
      }
    } catch {
      // 壊れた行は無視
    }
  }
  return result;
}

// ── 公開関数 ────────────────────────────────────────────

/**
 * ログファイルを解析して ABResult を返す。キャッシュなし（常に再計算）。
 * 勝者判定は revenue_per_click（収益最大化）ベース。
 */
export function getABResult(): ABResult {
  const { clicks, purchases, revenue } = parseLog();

  const makeStats = (v: Variant): VariantStats => ({
    variant:         v,
    clicks:          clicks[v],
    purchases:       purchases[v],
    totalAmount:     revenue[v],
    cvr:             clicks[v] > 0 ? purchases[v] / clicks[v] : 0,
    revenuePerClick: clicks[v] > 0 ? revenue[v] / clicks[v] : 0,
  });

  const A = makeStats("A");
  const B = makeStats("B");

  const enoughData =
    A.clicks >= MIN_CLICKS_FOR_DECISION &&
    B.clicks >= MIN_CLICKS_FOR_DECISION;

  let winner: Variant | null = null;
  if (enoughData) {
    // revenue_per_click ベースで勝者決定（CVR より売上を優先）
    if (A.revenuePerClick > B.revenuePerClick)      winner = "A";
    else if (B.revenuePerClick > A.revenuePerClick) winner = "B";
    // 同率の場合は null のまま（判定保留）
  }

  const totalClicks    = A.clicks + B.clicks;
  const totalPurchases = A.purchases + B.purchases;
  const totalRevenue   = A.totalAmount + B.totalAmount;
  const winnerStats    = winner ? (winner === "A" ? A : B) : null;

  return {
    A, B,
    winner,
    winnerCVR:  winnerStats?.cvr ?? 0,
    winnerRPC:  winnerStats?.revenuePerClick ?? 0,
    totalClicks,
    totalPurchases,
    totalRevenue,
    overallCVR: totalClicks > 0 ? totalPurchases / totalClicks : 0,
  };
}

/**
 * 異常検知: ABResult をチェックして警告リストを返す。
 */
export function detectABAnomaly(result: ABResult): string[] {
  const warnings: string[] = [];
  for (const s of [result.A, result.B]) {
    if (s.clicks > 0 && s.purchases === 0) {
      warnings.push(`Variant ${s.variant}: ${s.clicks}クリックあるが購入0（CV障害の可能性）`);
    }
    if (s.purchases > s.clicks) {
      warnings.push(`Variant ${s.variant}: 購入数(${s.purchases})がクリック数(${s.clicks})を超過（ログバグ）`);
    }
  }
  return warnings;
}

/**
 * 現在の勝者を Supabase の ab_results テーブルに保存する。
 */
export async function saveABResultToDB(result: ABResult): Promise<void> {
  if (!result.winner) return;

  await supabase
    .from("ab_results")
    .update({ is_current: false } as never)
    .eq("is_current", true);

  await supabase.from("ab_results").insert({
    winner:              result.winner,
    decided_at:          new Date().toISOString(),
    click_count_a:       result.A.clicks,
    click_count_b:       result.B.clicks,
    cvr_a:               result.A.cvr,
    cvr_b:               result.B.cvr,
    revenue_per_click_a: result.A.revenuePerClick,
    revenue_per_click_b: result.B.revenuePerClick,
    is_current:          true,
  } as never);
}

/**
 * DB から最新の勝者レコードを取得する。
 */
export async function loadABResultFromDB(): Promise<{
  winner:              Variant;
  click_count_a:       number;
  click_count_b:       number;
  cvr_a:               number;
  cvr_b:               number;
  revenue_per_click_a: number;
  revenue_per_click_b: number;
  decided_at:          string;
} | null> {
  const { data } = await supabase
    .from("ab_results")
    .select("winner, click_count_a, click_count_b, cvr_a, cvr_b, revenue_per_click_a, revenue_per_click_b, decided_at")
    .eq("is_current", true)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const w = data.winner as Variant;
  if (w !== "A" && w !== "B") return null;
  const d = data as Record<string, unknown>;
  return {
    ...data,
    winner:              w,
    revenue_per_click_a: typeof d.revenue_per_click_a === "number" ? d.revenue_per_click_a : 0,
    revenue_per_click_b: typeof d.revenue_per_click_b === "number" ? d.revenue_per_click_b : 0,
  };
}

/**
 * ログに purchase イベントを追記する（price 付き）。
 * appraisals paid=1 確定時に API Route から呼ぶ。
 */
export function logPurchaseEvent(customerId: number, variant: Variant, price: number): void {
  const entry = {
    event:       "purchase",
    customerId,
    variant,
    price,
    purchasedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error("[logPurchaseEvent] write failed:", e);
  }
}

/**
 * 指定 customerId の最後のクリックイベントから variant を返す。
 */
export function getLastClickVariant(customerId: number): Variant | null {
  if (!fs.existsSync(LOG_PATH)) return null;

  const lines = fs.readFileSync(LOG_PATH, "utf-8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]) as LogEntry;
      if (entry.customerId !== customerId) continue;
      const ev = entry.event ?? (entry.clickedAt ? "click" : null);
      if (ev !== "click") continue;
      const v = entry.variant as Variant | undefined;
      if (v === "A" || v === "B") return v;
    } catch {}
  }
  return null;
}
