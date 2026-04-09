// ─── 売上データ定義 ────────────────────────────────────
import type { ProductId } from "./products";
import { PRODUCTS } from "./products";

export interface Sale {
  id:            number;
  customer_id:   number;
  customer_name: string;
  product_id:    ProductId;
  amount:        number;
  paid:          boolean;
  date:          string;   // YYYY-MM-DD
  note?:         string;
}

// ─── 集計型 ─────────────────────────────────────────
export interface ProductBreakdown {
  product_id: ProductId;
  label:      string;
  count:      number;
  revenue:    number;
}

export interface CustomerRevenueSummary {
  customer_id:   number;
  customer_name: string;
  total_revenue: number;
  sale_count:    number;
}

// ─── ダミーデータ（全顧客分）──────────────────────────
// 今日 = 2026-03-30 想定
export const DUMMY_SALES: Sale[] = [
  // ── 山田花子 (id:1) VIP・完全逆転購入済 ──────────────
  { id:  1, customer_id: 1, customer_name: "山田花子", product_id: "full_reversal",   amount: 19800, paid: true,  date: "2026-03-28" },
  { id:  2, customer_id: 1, customer_name: "山田花子", product_id: "paid_divination", amount: 15000, paid: true,  date: "2026-03-10" },
  { id:  3, customer_id: 1, customer_name: "山田花子", product_id: "paid_divination", amount:  9800, paid: true,  date: "2026-02-20" },
  { id:  4, customer_id: 1, customer_name: "山田花子", product_id: "destiny_fix",     amount: 15000, paid: true,  date: "2026-02-05" },
  { id:  5, customer_id: 1, customer_name: "山田花子", product_id: "paid_divination", amount: 15000, paid: true,  date: "2026-01-20" },

  // ── 佐藤美咲 (id:2) 有料鑑定購入済 ──────────────────
  { id:  6, customer_id: 2, customer_name: "佐藤美咲", product_id: "destiny_fix",     amount: 15000, paid: true,  date: "2026-03-20" },
  { id:  7, customer_id: 2, customer_name: "佐藤美咲", product_id: "paid_divination", amount:  9800, paid: true,  date: "2026-03-01" },
  { id:  8, customer_id: 2, customer_name: "佐藤美咲", product_id: "paid_divination", amount:  9800, paid: true,  date: "2026-02-10" },

  // ── 鈴木あい (id:3) 無料鑑定送信済 ──────────────────
  { id:  9, customer_id: 3, customer_name: "鈴木あい", product_id: "paid_divination", amount:  9800, paid: true,  date: "2026-03-29" },

  // ── 田中ゆき (id:4) 運命修正提案済 ──────────────────
  { id: 10, customer_id: 4, customer_name: "田中ゆき", product_id: "reversal_action", amount: 25000, paid: true,  date: "2026-03-25" },
  { id: 11, customer_id: 4, customer_name: "田中ゆき", product_id: "destiny_fix",     amount: 18000, paid: true,  date: "2026-03-05" },
  { id: 12, customer_id: 4, customer_name: "田中ゆき", product_id: "paid_divination", amount: 15000, paid: true,  date: "2026-02-15" },

  // ── 伊藤なな (id:5) 深層誘導済 ──────────────────────
  { id: 13, customer_id: 5, customer_name: "伊藤なな", product_id: "paid_divination", amount:  9800, paid: true,  date: "2026-03-15" },
  { id: 14, customer_id: 5, customer_name: "伊藤なな", product_id: "deep_psychology", amount: 30000, paid: false, date: "2026-03-28", note: "振込確認中" },

  // ── 高橋りん (id:6) 休眠 ────────────────────────────
  { id: 15, customer_id: 6, customer_name: "高橋りん", product_id: "paid_divination", amount:  9800, paid: true,  date: "2026-02-10" },
];

// ─── 集計ヘルパー ────────────────────────────────────

/** 支払済み売上合計 */
export function getTotalRevenue(sales: Sale[]): number {
  return sales.filter((s) => s.paid).reduce((sum, s) => sum + s.amount, 0);
}

/** 未収金合計 */
export function getUnpaidAmount(sales: Sale[]): number {
  return sales.filter((s) => !s.paid).reduce((sum, s) => sum + s.amount, 0);
}

/** 指定月の売上（YYYY-MM 形式） */
export function getMonthSales(sales: Sale[], month: string): Sale[] {
  return sales.filter((s) => s.date.startsWith(month));
}

/** 今月の売上 */
export function getThisMonthSales(sales: Sale[]): Sale[] {
  const now   = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return getMonthSales(sales, month);
}

/** 商品別売上集計（支払済みのみ、収益降順） */
export function getProductBreakdown(sales: Sale[]): ProductBreakdown[] {
  const map = new Map<ProductId, ProductBreakdown>();
  sales
    .filter((s) => s.paid)
    .forEach((s) => {
      const cur = map.get(s.product_id) ?? {
        product_id: s.product_id,
        label:      PRODUCTS.find((p) => p.id === s.product_id)?.label ?? s.product_id,
        count:      0,
        revenue:    0,
      };
      map.set(s.product_id, { ...cur, count: cur.count + 1, revenue: cur.revenue + s.amount });
    });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/** 顧客別累計購入額（支払済みのみ） */
export function getCustomerRevenueSummary(sales: Sale[]): CustomerRevenueSummary[] {
  const map = new Map<number, CustomerRevenueSummary>();
  sales
    .filter((s) => s.paid)
    .forEach((s) => {
      const cur = map.get(s.customer_id) ?? {
        customer_id:   s.customer_id,
        customer_name: s.customer_name,
        total_revenue: 0,
        sale_count:    0,
      };
      map.set(s.customer_id, { ...cur, total_revenue: cur.total_revenue + s.amount, sale_count: cur.sale_count + 1 });
    });
  return Array.from(map.values()).sort((a, b) => b.total_revenue - a.total_revenue);
}

/** 特定顧客の累計購入額（CustomerRow.total_amount の将来の置き換え先） */
export function getCustomerRevenue(customerId: number, sales: Sale[]): number {
  return sales
    .filter((s) => s.customer_id === customerId && s.paid)
    .reduce((sum, s) => sum + s.amount, 0);
}
