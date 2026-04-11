// 売上管理ページ（Supabase実データ）
export const dynamic = "force-dynamic";

import { supabase } from "@/lib/db";
import { getProduct } from "@/lib/products";
import type { ProductId } from "@/lib/products";

// ─── ヘルパー ─────────────────────────────────────────
function fmt(n: number) {
  return `¥${n.toLocaleString()}`;
}

// ─── ページ（async Server Component）────────────────
export default async function SalesPage() {

  // ── 初期値（DB失敗時のフォールバック）──────────────
  let monthRevenue   = 0;
  let monthPaidCount = 0;
  let totalRevenue   = 0;
  let totalPaidCount = 0;
  let unpaidAmount   = 0;
  let customerCount  = 0;

  let customerRank: {
    customer_id:   number;
    customer_name: string;
    total_revenue: number;
    sale_count:    number;
  }[] = [];

  let breakdown: {
    type_label: string;
    count:      number;
    revenue:    number;
  }[] = [];

  let recentSales: {
    id:            number;
    customer_name: string;
    type:          string;
    amount:        number;
    paid:          number;
    notes:         string | null;
    date:          string;
  }[] = [];

  try {
    // 全 appraisals を顧客名付きで取得し、JS で集計
    const { data: allAppraisals, error } = await supabase
      .from("appraisals")
      .select("id, customer_id, type, price, paid, notes, created_at, customers(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const appraisals = allAppraisals ?? [];

    // ── 月初・翌月初 ──────────────────────────────────
    const now = new Date();
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const thisMonth = appraisals.filter((a) => {
      const d = new Date(a.created_at as string);
      return d >= monthStart && d < nextMonthStart;
    });

    // ── サマリー集計 ───────────────────────────────────
    monthRevenue   = thisMonth.filter((a) => a.paid === 1).reduce((s, a) => s + (a.price ?? 0), 0);
    monthPaidCount = thisMonth.filter((a) => a.paid === 1).length;
    totalRevenue   = appraisals.filter((a) => a.paid === 1).reduce((s, a) => s + (a.price ?? 0), 0);
    totalPaidCount = appraisals.filter((a) => a.paid === 1).length;
    unpaidAmount   = appraisals.filter((a) => a.paid === 0 && (a.price ?? 0) > 0).reduce((s, a) => s + (a.price ?? 0), 0);
    customerCount  = new Set(appraisals.filter((a) => a.paid === 1).map((a) => a.customer_id)).size;

    // ── 顧客別累計ランキング ────────────────────────────
    const byCustomer = new Map<number, { name: string; total: number; count: number }>();
    for (const a of appraisals) {
      if (a.paid !== 1) continue;
      const name = (a.customers as { name: string } | null)?.name ?? "不明";
      const prev = byCustomer.get(a.customer_id) ?? { name, total: 0, count: 0 };
      byCustomer.set(a.customer_id, { name, total: prev.total + (a.price ?? 0), count: prev.count + 1 });
    }
    customerRank = [...byCustomer.entries()]
      .map(([id, v]) => ({ customer_id: id, customer_name: v.name, total_revenue: v.total, sale_count: v.count }))
      .sort((a, b) => b.total_revenue - a.total_revenue);

    // ── 商品別売上（appraisals.type でグルーピング）───────
    const byType = new Map<string, { count: number; revenue: number }>();
    for (const a of appraisals) {
      if (a.paid !== 1) continue;
      const prev = byType.get(a.type) ?? { count: 0, revenue: 0 };
      byType.set(a.type, { count: prev.count + 1, revenue: prev.revenue + (a.price ?? 0) });
    }
    breakdown = [...byType.entries()]
      .map(([type_label, v]) => ({ type_label, count: v.count, revenue: v.revenue }))
      .filter((v) => v.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // ── 最近の売上（直近12件）──────────────────────────
    recentSales = appraisals.slice(0, 12).map((a) => ({
      id:            a.id,
      customer_name: (a.customers as { name: string } | null)?.name ?? "不明",
      type:          a.type,
      amount:        a.price ?? 0,
      paid:          a.paid,
      notes:         (a.notes as string | null) ?? null,
      date:          String(a.created_at).slice(0, 10),
    }));
  } catch (e) {
    console.error("[SalesPage] DB error:", e);
  }

  const maxRevenue = breakdown[0]?.revenue ?? 1;

  // ─── ページ ───────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── サマリーカード ────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "今月の売上",
            value: fmt(monthRevenue),
            note:  `${monthPaidCount} 件`,
            bg:    "bg-gradient-to-br from-brand-500 to-pink-500",
            text:  "text-white",
            sub:   "text-brand-100",
          },
          {
            label: "全期間累計",
            value: fmt(totalRevenue),
            note:  `${totalPaidCount} 件`,
            bg:    "bg-white border border-gray-100",
            text:  "text-gray-900",
            sub:   "text-gray-400",
          },
          {
            label: "未収金",
            value: fmt(unpaidAmount),
            note:  unpaidAmount > 0 ? "要確認" : "なし",
            bg:    unpaidAmount > 0 ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100",
            text:  unpaidAmount > 0 ? "text-red-700" : "text-gray-900",
            sub:   unpaidAmount > 0 ? "text-red-400" : "text-gray-400",
          },
          {
            label: "顧客数",
            value: `${customerCount} 名`,
            note:  "購入済み",
            bg:    "bg-white border border-gray-100",
            text:  "text-gray-900",
            sub:   "text-gray-400",
          },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl px-5 py-4 shadow-sm`}>
            <p className={`text-xs font-medium mb-1.5 ${c.sub}`}>{c.label}</p>
            <p className={`text-2xl font-bold ${c.text} leading-none`}>{c.value}</p>
            <p className={`text-xs mt-1.5 ${c.sub}`}>{c.note}</p>
          </div>
        ))}
      </div>

      {/* ── 2カラム：商品別 & 顧客ランク ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 商品別売上 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">種別売上</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">鑑定種別ごとの集計</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {breakdown.length === 0 ? (
              <p className="text-sm text-gray-300 py-6 text-center">データなし</p>
            ) : (
              breakdown.map((row) => {
                const product = getProduct(row.type_label as ProductId);
                const barPct  = Math.round((row.revenue / maxRevenue) * 100);
                return (
                  <div key={row.type_label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {product ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${product.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${product.dotClass}`} />
                            {product.label}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-700">{row.type_label}</span>
                        )}
                        <span className="text-xs text-gray-400">{row.count}件</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{fmt(row.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${product?.dotClass ?? "bg-brand-400"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 顧客別累計ランキング */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">顧客別累計</h3>
          </div>
          {customerRank.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-300">データなし</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {customerRank.map((c, i) => (
                <div key={c.customer_id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-700"
                    : i === 1 ? "bg-gray-100 text-gray-600"
                    : i === 2 ? "bg-orange-100 text-orange-600"
                    : "bg-gray-50 text-gray-400"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-700">{(c.customer_name || "?")[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.customer_name}</p>
                    <p className="text-[11px] text-gray-400">{c.sale_count}件</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-600 flex-shrink-0">
                    {fmt(c.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 最近の売上一覧 ───────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">最近の売上</h3>
        </div>
        {recentSales.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-300">売上データなし</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["日付", "顧客名", "種別", "金額", "支払"].map((h) => (
                      <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentSales.map((s) => {
                    const product = getProduct(s.type as ProductId);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{s.date}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-brand-700">{(s.customer_name || "?")[0]}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{s.customer_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {product ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${product.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${product.dotClass}`} />
                              {product.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">{s.type}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-semibold ${s.paid === 1 ? "text-gray-800" : "text-gray-400"}`}>
                            {fmt(s.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {s.paid === 1 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                              ✓ 済
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                                未収
                              </span>
                              {s.notes && <p className="text-[10px] text-gray-400 mt-0.5">{s.notes}</p>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
              <p className="text-xs text-gray-400">直近 {recentSales.length} 件を表示</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
