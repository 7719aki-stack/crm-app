// ─── 共通売上集計関数（Supabase実データ）────────────────
// dashboard / sales / 顧客一覧 が参照する single source of truth
//
// ⚠️ getABResult() は Node.js fs を使うため Server Component / API Route 専用。

import { supabase } from "./db";
import type { ProductId } from "./products";
import { getABResult, type ABResult } from "./abTest";

// ── 型定義 ──────────────────────────────────────────────

export interface SaleRecord {
  id:            number;
  customer_id:   number;
  customer_name: string;
  type:          ProductId | string;
  amount:        number;
  paid:          boolean;
  date:          string;          // YYYY-MM-DD
  notes?:        string | null;
}

export interface CustomerPurchaseSummary {
  customer_id:        number;
  customer_name:      string;
  total_revenue:      number;
  sale_count:         number;
  last_purchase_date: string | null; // YYYY-MM-DD
}

export interface ProductSaleBreakdown {
  type:    string;
  count:   number;
  revenue: number;
}

export interface SalesSummary {
  /** 今月売上（paid=1、当月 created_at） */
  monthlySales:       number;
  /** 今月支払済件数 */
  monthlyPaidCount:   number;
  /** 全期間累計売上 */
  totalSales:         number;
  /** 全期間支払済件数 */
  totalPaidCount:     number;
  /** 未収金合計（paid=0 かつ price>0） */
  unpaidAmount:       number;
  /** 購入済みユニーク顧客数（appraisals.paid=1 ベース。status 非依存） */
  paidCustomerCount:  number;
  /** 顧客別累計（降順） */
  customerPurchaseMap: CustomerPurchaseSummary[];
  /** 商品種別集計（降順） */
  productBreakdown:   ProductSaleBreakdown[];
  /** 直近売上レコード（最大10件） */
  recentSales:        SaleRecord[];
  // ── CVR / ABテスト ──────────────────────────────────
  /** リマインダークリック総数（reminder.log から集計） */
  clickCount:         number;
  /** コンバージョン率 = totalPaidCount / clickCount（clickCount=0 なら 0） */
  conversionRate:     number;
  /** ABテスト結果 */
  abResult:           ABResult;
}

// ABResult を再エクスポート（ダッシュボード等から型を使えるように）
export type { ABResult };

// ── 集計メイン関数 ───────────────────────────────────────

/**
 * Supabase の appraisals テーブルを読み込み、売上サマリーを返す。
 * 売上条件: paid = 1（支払済み）のみ。
 * URLクリックだけでは売上に含めない。
 */
export async function getSalesSummary(): Promise<SalesSummary> {
  const now             = new Date();
  const monthStart      = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart  = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data, error } = await supabase
    .from("appraisals")
    .select("id, customer_id, type, price, paid, notes, created_at, customers(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const appraisals = data ?? [];

  // ── 正規化 ────────────────────────────────────────────
  const records: SaleRecord[] = appraisals.map((a) => ({
    id:            a.id,
    customer_id:   a.customer_id,
    customer_name: (a.customers as { name: string } | null)?.name ?? "不明",
    type:          a.type as ProductId,
    amount:        a.price ?? 0,
    paid:          a.paid === 1,
    date:          String(a.created_at).slice(0, 10),
    notes:         (a.notes as string | null) ?? null,
  }));

  // ── 今月 ────────────────────────────────────────────
  const thisMonthPaid = records.filter((r) => {
    if (!r.paid) return false;
    const d = new Date(r.date);
    return d >= monthStart && d < nextMonthStart;
  });
  const monthlySales     = thisMonthPaid.reduce((s, r) => s + r.amount, 0);
  const monthlyPaidCount = thisMonthPaid.length;

  // ── 全期間 ───────────────────────────────────────────
  const paidAll      = records.filter((r) => r.paid);
  const totalSales   = paidAll.reduce((s, r) => s + r.amount, 0);
  const totalPaidCount = paidAll.length;

  // ── 未収 ────────────────────────────────────────────
  const unpaidAmount = records
    .filter((r) => !r.paid && r.amount > 0)
    .reduce((s, r) => s + r.amount, 0);

  // ── 購入済みユニーク顧客数（appraisals.paid=1 ベース） ──
  const paidCustomerCount = new Set(paidAll.map((r) => r.customer_id)).size;

  // ── 顧客別累計 ────────────────────────────────────────
  const byCustomer = new Map<number, CustomerPurchaseSummary>();
  for (const r of paidAll) {
    const prev = byCustomer.get(r.customer_id) ?? {
      customer_id:        r.customer_id,
      customer_name:      r.customer_name,
      total_revenue:      0,
      sale_count:         0,
      last_purchase_date: null,
    };
    byCustomer.set(r.customer_id, {
      ...prev,
      total_revenue: prev.total_revenue + r.amount,
      sale_count:    prev.sale_count + 1,
      // appraisals は created_at 降順取得なので最初のものが最新
      last_purchase_date: prev.last_purchase_date ?? r.date,
    });
  }
  const customerPurchaseMap = [...byCustomer.values()].sort(
    (a, b) => b.total_revenue - a.total_revenue,
  );

  // ── 商品別 ────────────────────────────────────────────
  const byProduct = new Map<string, ProductSaleBreakdown>();
  for (const r of paidAll) {
    const prev = byProduct.get(r.type) ?? { type: r.type, count: 0, revenue: 0 };
    byProduct.set(r.type, {
      ...prev,
      count:   prev.count   + 1,
      revenue: prev.revenue + r.amount,
    });
  }
  const productBreakdown = [...byProduct.values()]
    .filter((v) => v.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  // ── 直近売上 ─────────────────────────────────────────
  const recentSales = records.slice(0, 10);

  // ── CVR / ABテスト ────────────────────────────────────
  const abResult      = getABResult();
  const clickCount    = abResult.totalClicks;
  // CVR: 全期間の支払済件数 ÷ クリック数（クリック=0なら 0）
  const conversionRate = clickCount > 0 ? totalPaidCount / clickCount : 0;

  return {
    monthlySales,
    monthlyPaidCount,
    totalSales,
    totalPaidCount,
    unpaidAmount,
    paidCustomerCount,
    customerPurchaseMap,
    productBreakdown,
    recentSales,
    clickCount,
    conversionRate,
    abResult,
  };
}

// ── 顧客別購入マップのみ取得（顧客一覧向け軽量版）────────────

export async function getCustomerPurchaseData(): Promise<
  Map<number, { total_amount: number; last_purchase_date: string | null; purchase_count: number }>
> {
  const { data, error } = await supabase
    .from("appraisals")
    .select("customer_id, price, created_at")
    .eq("paid", 1)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const map = new Map<number, { total_amount: number; last_purchase_date: string | null; purchase_count: number }>();
  for (const a of data ?? []) {
    const prev = map.get(a.customer_id) ?? { total_amount: 0, last_purchase_date: null, purchase_count: 0 };
    map.set(a.customer_id, {
      total_amount:       prev.total_amount + (a.price ?? 0),
      last_purchase_date: prev.last_purchase_date ?? String(a.created_at).slice(0, 10),
      purchase_count:     prev.purchase_count + 1,
    });
  }
  return map;
}

// ── total_amount 同期ヘルパー ─────────────────────────────

/**
 * 指定顧客の appraisals.paid=1 を合算して customers.total_amount に書き込む。
 * 購入記録を追加・更新した直後に呼び出す。
 */
export async function syncCustomerTotalAmount(customerId: number): Promise<void> {
  const { data } = await supabase
    .from("appraisals")
    .select("price")
    .eq("customer_id", customerId)
    .eq("paid", 1);

  const total = (data ?? []).reduce((s, a) => s + (a.price ?? 0), 0);

  await supabase
    .from("customers")
    .update({ total_amount: total, updated_at: new Date().toISOString() })
    .eq("id", customerId);
}
