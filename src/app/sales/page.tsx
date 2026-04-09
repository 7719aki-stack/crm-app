// 売上管理ページ（ダミーデータ表示・次フェーズでDB連携）
import {
  DUMMY_SALES,
  getTotalRevenue,
  getUnpaidAmount,
  getThisMonthSales,
  getProductBreakdown,
  getCustomerRevenueSummary,
} from "@/lib/sales";
import { getProduct, PRODUCTS } from "@/lib/products";

// ─── 集計 ────────────────────────────────────────────
const thisMonth    = getThisMonthSales(DUMMY_SALES);
const monthRevenue = getTotalRevenue(thisMonth);
const totalRevenue = getTotalRevenue(DUMMY_SALES);
const unpaid       = getUnpaidAmount(DUMMY_SALES);
const breakdown    = getProductBreakdown(DUMMY_SALES);
const customerRank = getCustomerRevenueSummary(DUMMY_SALES);
const recentSales  = [...DUMMY_SALES].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
const maxRevenue   = breakdown[0]?.revenue ?? 1;

// ─── ヘルパー ─────────────────────────────────────────
function fmt(n: number) {
  return `¥${n.toLocaleString()}`;
}

// ─── ページ ───────────────────────────────────────────
export default function SalesPage() {
  return (
    <div className="space-y-5">

      {/* ── サマリーカード ────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "今月の売上",
            value: fmt(monthRevenue),
            note:  `${thisMonth.filter((s) => s.paid).length} 件`,
            bg:    "bg-gradient-to-br from-brand-500 to-pink-500",
            text:  "text-white",
            sub:   "text-brand-100",
          },
          {
            label: "全期間累計",
            value: fmt(totalRevenue),
            note:  `${DUMMY_SALES.filter((s) => s.paid).length} 件`,
            bg:    "bg-white border border-gray-100",
            text:  "text-gray-900",
            sub:   "text-gray-400",
          },
          {
            label: "未収金",
            value: fmt(unpaid),
            note:  unpaid > 0 ? "要確認" : "なし",
            bg:    unpaid > 0 ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100",
            text:  unpaid > 0 ? "text-red-700" : "text-gray-900",
            sub:   unpaid > 0 ? "text-red-400" : "text-gray-400",
          },
          {
            label: "顧客数",
            value: `${customerRank.length} 名`,
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
            <h3 className="text-sm font-semibold text-gray-800">商品別売上</h3>
          </div>
          <div className="px-5 py-4 space-y-4">
            {breakdown.length === 0 ? (
              <p className="text-sm text-gray-300 py-6 text-center">データなし</p>
            ) : (
              breakdown.map((row) => {
                const product = getProduct(row.product_id);
                const barPct  = Math.round((row.revenue / maxRevenue) * 100);
                return (
                  <div key={row.product_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {product && (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${product.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${product.dotClass}`} />
                            {product.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{row.count}件</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{fmt(row.revenue)}</span>
                    </div>
                    {/* バー */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${product?.dotClass ?? "bg-gray-400"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
            {/* 未設定商品（ゼロ件）もグレーで表示 */}
            {PRODUCTS.filter((p) => !breakdown.find((b) => b.product_id === p.id)).map((p) => (
              <div key={p.id} className="opacity-30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${p.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dotClass}`} />
                    {p.label}
                  </span>
                  <span className="text-xs text-gray-400">¥0</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* 顧客別累計ランキング */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">顧客別累計</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {customerRank.map((c, i) => (
              <div key={c.customer_id} className="flex items-center gap-3 px-5 py-3.5">
                {/* 順位 */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? "bg-amber-100 text-amber-700"
                  : i === 1 ? "bg-gray-100 text-gray-600"
                  : i === 2 ? "bg-orange-100 text-orange-600"
                  : "bg-gray-50 text-gray-400"
                }`}>
                  {i + 1}
                </span>
                {/* アバター */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-700">{c.customer_name[0]}</span>
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
        </div>
      </div>

      {/* ── 最近の売上一覧 ───────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">最近の売上</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["日付", "顧客名", "商品", "金額", "支払"].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentSales.map((s) => {
                const product = getProduct(s.product_id);
                return (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{s.date}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-brand-700">{s.customer_name[0]}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{s.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {product && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${product.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${product.dotClass}`} />
                          {product.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-semibold ${s.paid ? "text-gray-800" : "text-gray-400"}`}>
                        {fmt(s.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {s.paid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          ✓ 済
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                            未収
                          </span>
                          {s.note && <p className="text-[10px] text-gray-400 mt-0.5">{s.note}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
          <p className="text-xs text-gray-400">
            直近 {recentSales.length} 件を表示 / 全 {DUMMY_SALES.length} 件
          </p>
        </div>
      </div>
    </div>
  );
}
