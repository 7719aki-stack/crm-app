// ─── ABテスト分析エンジン（サーバー専用）────────────────────
// logs/reminder.log を解析して variant ごとの profit_per_click を算出し、
// 勝者バリアントを決定する。勝者は Supabase の ab_results テーブルに永続化。
//
// 収益エンジン構造:
//   click → purchase → upsell  すべてログ集計
//   profit_per_click = (購入売上 + アップセル売上) / クリック数
//
// ⚠️ Node.js の fs を使うため Server Component / API Route 専用。

import fs   from "fs";
import path from "path";
import { supabase } from "./db";

// ── 型定義 ──────────────────────────────────────────────

export type Variant = "A" | "B";

export interface VariantStats {
  variant:         Variant;
  clicks:          number;
  purchases:       number;
  upsells:         number;   // アップセル成約数
  totalAmount:     number;   // 購入売上合計（円）
  upsellAmount:    number;   // アップセル売上合計（円）
  cvr:             number;   // 購入率 purchases/clicks
  upsellRate:      number;   // アップセル率 upsells/purchases
  revenuePerClick: number;   // 購入売上のみ / クリック数
  profitPerClick:  number;   // (購入売上 + アップセル売上) / クリック数（勝者判定指標）
}

export interface ABResult {
  A:                  VariantStats;
  B:                  VariantStats;
  /** null = データ不足で判定不可 */
  winner:             Variant | null;
  winnerCVR:          number;
  winnerRPC:          number;
  winnerPPC:          number;   // 勝者の profit_per_click
  totalClicks:        number;
  totalPurchases:     number;
  totalUpsells:       number;
  totalRevenue:       number;   // 購入売上合計
  totalUpsellRevenue: number;   // アップセル売上合計
  overallCVR:         number;
  overallUpsellRate:  number;
}

// ── 定数 ────────────────────────────────────────────────

export const MIN_CLICKS_FOR_DECISION = 10;
const LOG_PATH = path.join(process.cwd(), "logs", "reminder.log");

// ── ログ解析 ────────────────────────────────────────────

interface LogEntry {
  event?:       string;      // "click" | "purchase" | "upsell" | undefined
  customerId?:  number;
  variant?:     string;
  sendCount?:   number;
  clickedAt?:   string;
  purchasedAt?: string;
  upsellAt?:    string;
  price?:       number;
  accepted?:    boolean;     // upsell イベントのみ
}

function parseLog(): {
  clicks:        Record<Variant, number>;
  purchases:     Record<Variant, number>;
  revenue:       Record<Variant, number>;
  upsells:       Record<Variant, number>;
  upsellRevenue: Record<Variant, number>;
} {
  const result = {
    clicks:        { A: 0, B: 0 } as Record<Variant, number>,
    purchases:     { A: 0, B: 0 } as Record<Variant, number>,
    revenue:       { A: 0, B: 0 } as Record<Variant, number>,
    upsells:       { A: 0, B: 0 } as Record<Variant, number>,
    upsellRevenue: { A: 0, B: 0 } as Record<Variant, number>,
  };

  if (!fs.existsSync(LOG_PATH)) return result;

  const lines = fs.readFileSync(LOG_PATH, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      const v = entry.variant as Variant | undefined;
      if (v !== "A" && v !== "B") continue;

      const ev = entry.event ?? (entry.clickedAt ? "click" : null);

      if (ev === "click") {
        result.clicks[v]++;
      } else if (ev === "purchase") {
        result.purchases[v]++;
        result.revenue[v] += typeof entry.price === "number" ? entry.price : 0;
      } else if (ev === "upsell" && entry.accepted === true) {
        result.upsells[v]++;
        result.upsellRevenue[v] += typeof entry.price === "number" ? entry.price : 0;
      }
    } catch {
      // 壊れた行は無視
    }
  }
  return result;
}

// ── 公開関数 ────────────────────────────────────────────

/**
 * ログを解析して ABResult を返す（キャッシュなし）。
 * 勝者判定は profit_per_click = (購入売上 + アップセル売上) / クリック数。
 */
export function getABResult(): ABResult {
  const { clicks, purchases, revenue, upsells, upsellRevenue } = parseLog();

  const makeStats = (v: Variant): VariantStats => {
    const c   = clicks[v];
    const p   = purchases[v];
    const u   = upsells[v];
    const rev = revenue[v];
    const ups = upsellRevenue[v];
    return {
      variant:         v,
      clicks:          c,
      purchases:       p,
      upsells:         u,
      totalAmount:     rev,
      upsellAmount:    ups,
      cvr:             c > 0 ? p / c : 0,
      upsellRate:      p > 0 ? u / p : 0,
      revenuePerClick: c > 0 ? rev / c : 0,
      profitPerClick:  c > 0 ? (rev + ups) / c : 0,
    };
  };

  const A = makeStats("A");
  const B = makeStats("B");

  const enoughData =
    A.clicks >= MIN_CLICKS_FOR_DECISION &&
    B.clicks >= MIN_CLICKS_FOR_DECISION;

  let winner: Variant | null = null;
  if (enoughData) {
    // profit_per_click ベースで勝者決定（購入 + アップセル 全利益で判定）
    if (A.profitPerClick > B.profitPerClick)      winner = "A";
    else if (B.profitPerClick > A.profitPerClick) winner = "B";
  }

  const totalClicks        = A.clicks + B.clicks;
  const totalPurchases     = A.purchases + B.purchases;
  const totalUpsells       = A.upsells + B.upsells;
  const totalRevenue       = A.totalAmount + B.totalAmount;
  const totalUpsellRevenue = A.upsellAmount + B.upsellAmount;
  const winnerStats        = winner ? (winner === "A" ? A : B) : null;

  return {
    A, B,
    winner,
    winnerCVR:         winnerStats?.cvr ?? 0,
    winnerRPC:         winnerStats?.revenuePerClick ?? 0,
    winnerPPC:         winnerStats?.profitPerClick ?? 0,
    totalClicks,
    totalPurchases,
    totalUpsells,
    totalRevenue,
    totalUpsellRevenue,
    overallCVR:        totalClicks    > 0 ? totalPurchases / totalClicks : 0,
    overallUpsellRate: totalPurchases > 0 ? totalUpsells   / totalPurchases : 0,
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
    if (s.upsells > s.purchases) {
      warnings.push(`Variant ${s.variant}: アップセル数(${s.upsells})が購入数(${s.purchases})を超過（ログバグ）`);
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
    click_count_a:       typeof d.click_count_a       === "number" ? d.click_count_a       : 0,
    click_count_b:       typeof d.click_count_b       === "number" ? d.click_count_b       : 0,
    cvr_a:               typeof d.cvr_a               === "number" ? d.cvr_a               : 0,
    cvr_b:               typeof d.cvr_b               === "number" ? d.cvr_b               : 0,
    revenue_per_click_a: typeof d.revenue_per_click_a === "number" ? d.revenue_per_click_a : 0,
    revenue_per_click_b: typeof d.revenue_per_click_b === "number" ? d.revenue_per_click_b : 0,
    decided_at:          typeof d.decided_at           === "string" ? d.decided_at           : "",
  };
}

/**
 * purchase イベントをログに追記。appraisals paid=1 時に呼ぶ。
 */
export function logPurchaseEvent(customerId: number, variant: Variant, price: number): void {
  appendLog({
    event:       "purchase",
    customerId,
    variant,
    price,
    purchasedAt: new Date().toISOString(),
  });
}

/**
 * upsell イベントをログに追記。/api/upsell 成功時に呼ぶ。
 */
export function logUpsellEvent(
  customerId: number,
  variant:    Variant,
  price:      number,
  accepted:   boolean,
): void {
  appendLog({
    event:     "upsell",
    customerId,
    variant,
    price,
    accepted,
    upsellAt:  new Date().toISOString(),
  });
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

// ── 内部ヘルパー ─────────────────────────────────────────

function appendLog(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error("[abTest] appendLog failed:", e);
  }
}
