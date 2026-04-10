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
