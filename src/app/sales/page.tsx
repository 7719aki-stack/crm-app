"use client";

import { useEffect, useState, useMemo } from "react";
import { getProduct } from "@/lib/products";
import type { ProductId } from "@/lib/products";

interface SaleRow {
  id:            number;
  customer_id:   number;
  customer_name: string;
  type:          string;
  price:         number;
  paid:          number;
  notes:         string | null;
  created_at:    string;
}

function fmt(n: number) {
  return `¥${n.toLocaleString()}`;
}

function toDateStr(s: string) {
  return String(s).slice(0, 10);
}

export default function SalesPage() {
  const [rows, setRows]           = useState<SaleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [paidOnly, setPaidOnly]   = useState(false);
  const [monthOnly, setMonthOnly] = useState(false);

  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((data: SaleRow[]) => { setRows(Array.isArray(data) ? data : []); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  // ── 月初・翌月初 ────────────────────────────────────────
  const now            = new Date();
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const filtered = useMemo(() => {
    let list = rows;
    if (paidOnly)  list = list.filter((r) => r.paid === 1);
    if (monthOnly) list = list.filter((r) => {
      const d = new Date(r.created_at);
      return d >= monthStart && d < nextMonthStart;
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, paidOnly, monthOnly]);

  // ── サマリー集計 ─────────────────────────────────────────
  const summary = useMemo(() => {
    const thisMonthPaid = rows.filter((r) => {
      if (r.paid !== 1) return false;
      const d = new Date(r.created_at);
      return d >= monthStart && d < nextMonthStart;
    });

    const monthRevenue   = thisMonthPaid.reduce((s, r) => s + r.price, 0);
    const monthPaidCount = thisMonthPaid.length;
    const monthAvg       = monthPaidCount > 0 ? Math.round(monthRevenue / monthPaidCount) : 0;

    const totalRevenue   = rows.filter((r) => r.paid === 1).reduce((s, r) => s + r.price, 0);
    const totalPaidCount = rows.filter((r) => r.paid === 1).length;
    const unpaidAmount   = rows.filter((r) => r.paid === 0 && r.price > 0).reduce((s, r) => s + r.price, 0);
    const customerCount  = new Set(rows.filter((r) => r.paid === 1).map((r) => r.customer_id)).size;

    return { monthRevenue, monthPaidCount, monthAvg, totalRevenue, totalPaidCount, unpaidAmount, customerCount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // ── 顧客別累計 ──────────────────────────────────────────
  const customerRank = useMemo(() => {
    const map = new Map<number, { name: string; total: number; count: number }>();
    for (const r of rows) {
      if (r.paid !== 1) continue;
      const prev = map.get(r.customer_id) ?? { name: r.customer_name, total: 0, count: 0 };
      map.set(r.customer_id, { name: r.customer_name, total: prev.total + r.price, count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([id, v]) => ({ customer_id: id, customer_name: v.name, total_revenue: v.total, sale_count: v.count }))
      .sort((a, b) => b.total_revenue - a.total_revenue);
  }, [rows]);

  // ── 種別集計 ────────────────────────────────────────────
  const breakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of rows) {
      if (r.paid !== 1) continue;
      const prev = map.get(r.type) ?? { count: 0, revenue: 0 };
      map.set(r.type, { count: prev.count + 1, revenue: prev.revenue + r.price });
    }
    return [...map.entries()]
      .map(([type_label, v]) => ({ type_label, ...v }))
      .filter((v) => v.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const maxRevenue = breakdown[0]?.revenue ?? 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── サマリーカード ─────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "今月の売上",
            value: fmt(summary.monthRevenue),
            note:  `${summary.monthPaidCount} 件 / 平均 ${fmt(summary.monthAvg)}`,
            bg:    "bg-gradient-to-br from-brand-500 to-pink-500",
            text:  "text-white",
            sub:   "text-brand-100",
          },
          {
            label: "全期間累計",
            value: fmt(summary.totalRevenue),
            note:  `${summary.totalPaidCount} 件`,
            bg:    "bg-white border border-gray-100",
            text:  "text-gray-900",
            sub:   "text-gray-400",
          },
          {
            label: "未収金",
            value: fmt(summary.unpaidAmount),
            note:  summary.unpaidAmount > 0 ? "要確認" : "なし",
            bg:    summary.unpaidAmount > 0 ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100",
            text:  summary.unpaidAmount > 0 ? "text-red-700" : "text-gray-900",
            sub:   summary.unpaidAmount > 0 ? "text-red-400" : "text-gray-400",
          },
          {
            label: "顧客数",
            value: `${summary.customerCount} 名`,
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

      {/* ── 2カラム：種別 & 顧客ランク ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 種別売上 */}
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

      {/* ── 売上一覧 ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">売上一覧</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{filtered.length} 件</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthOnly((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                monthOnly
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
              }`}
            >
              今月のみ
            </button>
            <button
              onClick={() => setPaidOnly((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                paidOnly
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
              }`}
            >
              支払済のみ
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-300">売上データなし</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["日付", "顧客名", "種別", "金額", "支払", "メモ"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => {
                  const product = getProduct(s.type as ProductId);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{toDateStr(s.created_at)}</td>
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
                          {fmt(s.price)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {s.paid === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            ✓ 済
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                            未収
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400 max-w-[160px] truncate">
                        {s.notes ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
