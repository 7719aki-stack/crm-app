// ダッシュボード（Supabase実データ）
export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/db";
import { getSalesSummary } from "@/lib/getSalesSummary";
import { detectABAnomaly } from "@/lib/abTest";
import { getStatus } from "@/lib/statuses";
import { getProduct } from "@/lib/products";
import type { ProductId } from "@/lib/products";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CustomerRow, CrisisLevel } from "@/app/customers/dummyData";

// ─── ファネル分布グループ定義（設定値） ──────────────────
const funnelGroups = [
  { group: "lead",       label: "リード段階",   dotCls: "bg-blue-400" },
  { group: "divination", label: "鑑定段階",     dotCls: "bg-cyan-500" },
  { group: "paid",       label: "有料転換",     dotCls: "bg-emerald-500" },
  { group: "upsell",     label: "アップセル",   dotCls: "bg-violet-500" },
  { group: "exit",       label: "離脱",         dotCls: "bg-gray-400" },
] as const;

// ─── 危機度ドット（ミニサイズ）────────────────────────────
const CRISIS_DOT_CLS: Record<CrisisLevel, string> = {
  1: "bg-gray-300", 2: "bg-yellow-400", 3: "bg-amber-400",
  4: "bg-orange-500", 5: "bg-red-500",
};
function MiniCrisis({ level }: { level: CrisisLevel }) {
  return (
    <div className="flex gap-[3px]">
      {([1, 2, 3, 4, 5] as CrisisLevel[]).map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= level ? CRISIS_DOT_CLS[level] : "bg-gray-100"}`}
        />
      ))}
    </div>
  );
}

// ─── 次回アクション表示 ───────────────────────────────────
function ActionLabel({ date }: { date: string | null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!date) return <span className="text-xs text-gray-300">未設定</span>;
  const d = new Date(date);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return <span className="text-xs font-semibold text-red-600">⚠ {date}（{Math.abs(diff)}日超過）</span>;
  if (diff === 0) return <span className="text-xs font-semibold text-orange-600">今日</span>;
  if (diff === 1) return <span className="text-xs font-medium text-amber-600">明日</span>;
  return <span className="text-xs text-gray-500">{date}</span>;
}

// ─── ページ本体（async Server Component）─────────────────
export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  // ── 初期値（DB失敗時のフォールバック）──────────────────
  let customers: CustomerRow[] = [];
  let monthRevenue      = 0;
  let monthPaidCount    = 0;
  let paidCustomerCount = 0;
  let conversionRate    = 0;
  let clickCount        = 0;
  let avgOrderValue     = 0;
  let ltv               = 0;
  let upsellCount       = 0;
  let upsellRate        = 0;
  let upsellRevenue     = 0;
  let abAnomalies: string[] = [];
  let abResult: import("@/lib/getSalesSummary").ABResult = {
    A: { variant: "A", clicks: 0, purchases: 0, upsells: 0, totalAmount: 0, upsellAmount: 0, cvr: 0, upsellRate: 0, revenuePerClick: 0, profitPerClick: 0 },
    B: { variant: "B", clicks: 0, purchases: 0, upsells: 0, totalAmount: 0, upsellAmount: 0, cvr: 0, upsellRate: 0, revenuePerClick: 0, profitPerClick: 0 },
    winner: null, winnerCVR: 0, winnerRPC: 0, winnerPPC: 0,
    totalClicks: 0, totalPurchases: 0, totalUpsells: 0,
    totalRevenue: 0, totalUpsellRevenue: 0, overallCVR: 0, overallUpsellRate: 0,
  };
  let recentSales: {
    id: number;
    customer_name: string;
    type: string;
    amount: number;
    paid: number;
    date: string;
  }[] = [];

  try {
    // 顧客一覧（優先対応・ファネル分布用）
    const { data: rows, error: custError } = await supabase
      .from("customers")
      .select("id, name, display_name, category, status, tags, crisis_level, temperature, next_action, total_amount, updated_at")
      .order("updated_at", { ascending: false });

    if (custError) throw custError;

    customers = (rows ?? []).map((r) => ({
      id:           r.id,
      name:         r.name,
      display_name: r.display_name ?? r.name,
      category:     (r.category as CustomerRow["category"]) ?? "片思い",
      status:       (r.status   as CustomerRow["status"])   ?? "new_reg",
      tags:         (() => { try { return JSON.parse(r.tags || "[]"); } catch { return []; } })() as string[],
      crisis_level: (Math.min(5, Math.max(1, r.crisis_level ?? 1))) as CrisisLevel,
      temperature:  (r.temperature as CustomerRow["temperature"]) ?? "cool",
      last_contact: r.updated_at ? String(r.updated_at).slice(0, 10) : "",
      next_action:  r.next_action ?? null,
      total_amount: r.total_amount ?? 0,
    }));

    // 売上KPI・購入人数・CVR・AB は getSalesSummary から一括取得
    const summary = await getSalesSummary();
    monthRevenue      = summary.monthlySales;
    monthPaidCount    = summary.monthlyPaidCount;
    paidCustomerCount = summary.paidCustomerCount;
    conversionRate    = summary.conversionRate;
    clickCount        = summary.clickCount;
    avgOrderValue     = summary.avgOrderValue;
    ltv               = summary.ltv;
    upsellCount       = summary.upsellCount;
    upsellRate        = summary.upsellRate;
    upsellRevenue     = summary.upsellRevenue;
    abResult          = summary.abResult;
    abAnomalies       = detectABAnomaly(summary.abResult);

    // 最近の購入（直近5件）
    recentSales = summary.recentSales.slice(0, 5).map((s) => ({
      id:            s.id,
      customer_name: s.customer_name,
      type:          s.type,
      amount:        s.amount,
      paid:          s.paid ? 1 : 0,
      date:          s.date,
    }));
  } catch (e) {
    console.error("[DashboardPage] DB error:", e);
  }

  // ─── 集計 ─────────────────────────────────────────────
  const leadCount       = customers.filter((c) => getStatus(c.status)?.group === "lead").length;
  const divinationCount = customers.filter((c) => getStatus(c.status)?.group === "divination").length;
  const preConvertCount = customers.filter((c) => c.status === "deep_guided").length;
  // 有料購入済人数: appraisals.paid=1 のユニーク顧客数（status 非依存）
  // paidCustomerCount は getSalesSummary() で取得済み

  // ① 期限切れ → ② temperature 高い → ③ ID降順（新規登録優先）
  const TEMP_SCORE: Record<string, number> = { hot: 3, warm: 2, cool: 1, cold: 0 };
  const priorityCustomers: CustomerRow[] = customers
    .filter((c) => getStatus(c.status)?.group !== "exit")
    .sort((a, b) => {
      const aOverdue = !!a.next_action && new Date(a.next_action) < today;
      const bOverdue = !!b.next_action && new Date(b.next_action) < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const tDiff = (TEMP_SCORE[b.temperature] ?? 0) - (TEMP_SCORE[a.temperature] ?? 0);
      if (tDiff !== 0) return tDiff;
      return b.id - a.id;
    })
    .slice(0, 3);

  const funnelData = funnelGroups.map(({ group, label, dotCls }) => ({
    label,
    dotCls,
    count: customers.filter((c) => getStatus(c.status)?.group === group).length,
  }));
  const maxFunnelCount = Math.max(...funnelData.map((f) => f.count), 1);

  // ─── ページ本体 ───────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── KPI カード ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          {
            label: "顧客総数",
            sublabel: "登録顧客",
            value: customers.length,
            unit: "名",
            iconCls: "bg-blue-100 text-blue-600",
            valCls: "text-blue-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            ),
          },
          {
            label: "鑑定待ち",
            sublabel: "誘導済〜送信済",
            value: divinationCount,
            unit: "名",
            iconCls: "bg-cyan-100 text-cyan-600",
            valCls: "text-cyan-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ),
          },
          {
            label: "有料転換前",
            sublabel: "深層誘導済",
            value: preConvertCount,
            unit: "名",
            iconCls: "bg-amber-100 text-amber-600",
            valCls: "text-amber-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            ),
          },
          {
            label: "有料購入済",
            sublabel: "appraisals.paid=1",
            value: paidCustomerCount,
            unit: "名",
            iconCls: "bg-emerald-100 text-emerald-600",
            valCls: "text-emerald-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: "今月売上",
            sublabel: `支払済み ${monthPaidCount}件`,
            value: null,
            valueStr: `¥${monthRevenue.toLocaleString()}`,
            unit: "",
            iconCls: "bg-brand-100 text-brand-600",
            valCls: "text-brand-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconCls}`}>
                {card.icon}
              </div>
            </div>
            <p className={`text-2xl font-bold leading-none ${card.valCls}`}>
              {card.valueStr ?? card.value}
              {!card.valueStr && <span className="text-sm font-normal text-gray-400 ml-1">{card.unit}</span>}
            </p>
            <p className="text-[11px] text-gray-400 mt-1.5">{card.sublabel}</p>
          </div>
        ))}
      </div>

      {/* ── 収益分析 KPI ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label:    "平均購入単価",
            sublabel: "全期間 paid=1 平均",
            valueStr: avgOrderValue > 0 ? `¥${Math.round(avgOrderValue).toLocaleString()}` : "—",
            iconCls:  "bg-violet-100 text-violet-600",
            valCls:   "text-violet-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            ),
          },
          {
            label:    "LTV",
            sublabel: "購入者あたり累計（含アップセル）",
            valueStr: ltv > 0 ? `¥${Math.round(ltv).toLocaleString()}` : "—",
            iconCls:  "bg-rose-100 text-rose-600",
            valCls:   "text-rose-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            ),
          },
          {
            label:    "アップセル率",
            sublabel: `${upsellCount}件成約 / ¥${upsellRevenue.toLocaleString()}`,
            valueStr: upsellRate > 0 ? `${(upsellRate * 100).toFixed(1)}%` : "—",
            iconCls:  "bg-amber-100 text-amber-600",
            valCls:   "text-amber-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            ),
          },
          {
            label:    "profit / click",
            sublabel: "購入+アップセル合算",
            valueStr: (abResult.A.clicks + abResult.B.clicks) > 0
              ? `¥${Math.round((abResult.totalRevenue + abResult.totalUpsellRevenue) / (abResult.totalClicks || 1)).toLocaleString()}`
              : "—",
            iconCls:  "bg-emerald-100 text-emerald-600",
            valCls:   "text-emerald-700",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ),
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconCls}`}>
                {card.icon}
              </div>
            </div>
            <p className={`text-2xl font-bold leading-none ${card.valCls}`}>{card.valueStr}</p>
            <p className="text-[11px] text-gray-400 mt-1.5">{card.sublabel}</p>
          </div>
        ))}
      </div>

      {/* ── CVR / ABテスト ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* ヘッダー */}
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800">ABテスト（Revenue Per Click 判定）</h3>
            {abResult.winner ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Variant {abResult.winner} 自動採用中
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                各 {10} クリックで自動判定
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400">
            全 {clickCount} クリック / {abResult.totalPurchases} 購入
          </span>
        </div>

        {/* 異常検知バナー */}
        {abAnomalies.length > 0 && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
            <p className="text-xs font-semibold text-red-700 mb-1">⚠ データ異常を検出</p>
            {abAnomalies.map((w, i) => (
              <p key={i} className="text-[11px] text-red-600">{w}</p>
            ))}
          </div>
        )}

        <div className="px-5 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* 全体 CVR */}
            <div className="flex flex-col justify-between bg-brand-50 rounded-xl border border-brand-100 px-4 py-3.5">
              <p className="text-xs font-semibold text-brand-600 mb-2">全体 CVR</p>
              <p className="text-3xl font-bold text-brand-700 leading-none">
                {clickCount === 0 ? "—" : `${(conversionRate * 100).toFixed(1)}%`}
              </p>
              <p className="text-[11px] text-brand-400 mt-2">
                {clickCount === 0
                  ? "クリックデータ待ち"
                  : `${clickCount} クリック → ${abResult.totalPurchases} 購入`}
              </p>
              {clickCount > 0 && (
                <div className="mt-2 h-1.5 bg-brand-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.min(conversionRate * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* AB 比較表 */}
            {(["A", "B"] as const).map((v) => {
              const s          = abResult[v];
              const isWinner   = abResult.winner === v;
              const hasData    = s.clicks > 0;
              const needMore   = s.clicks < 10;
              return (
                <div
                  key={v}
                  className={`rounded-xl border px-4 py-3.5 ${
                    isWinner
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-gray-100"
                  }`}
                >
                  {/* バリアント名 + 勝者バッジ */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold ${isWinner ? "text-emerald-700" : "text-gray-700"}`}>
                      Variant {v}
                    </span>
                    {isWinner && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                        ★ 勝者
                      </span>
                    )}
                    {!abResult.winner && needMore && hasData && (
                      <span className="text-[10px] text-gray-400">
                        あと {10 - s.clicks} click
                      </span>
                    )}
                  </div>

                  {/* RPC 大字（勝者判定指標） */}
                  <p className={`text-2xl font-bold leading-none ${isWinner ? "text-emerald-700" : "text-gray-700"}`}>
                    {hasData && s.revenuePerClick > 0 ? `¥${Math.round(s.revenuePerClick).toLocaleString()}` : "—"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">/ click</p>

                  {/* 内訳テーブル */}
                  <div className="mt-2 space-y-0.5 text-[11px]">
                    <div className="flex justify-between text-gray-500">
                      <span>クリック</span>
                      <span className="font-semibold text-gray-700">{s.clicks}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>購入</span>
                      <span className="font-semibold text-gray-700">{s.purchases}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>売上合計</span>
                      <span className="font-semibold text-gray-700">
                        {s.totalAmount > 0 ? `¥${s.totalAmount.toLocaleString()}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>RPC</span>
                      <span className={`font-bold ${isWinner ? "text-emerald-600" : "text-gray-700"}`}>
                        {hasData && s.revenuePerClick > 0 ? `¥${Math.round(s.revenuePerClick).toLocaleString()}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>CVR</span>
                      <span className="font-medium text-gray-600">
                        {hasData ? `${(s.cvr * 100).toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* 棒グラフ */}
                  {hasData && (
                    <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isWinner ? "bg-emerald-500" : "bg-gray-400"}`}
                        style={{ width: `${Math.min(s.cvr * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {abResult.totalClicks === 0 && (
            <p className="text-[11px] text-gray-400 mt-3 text-center">
              リマインダー送信 → URL クリック → 購入 の流れが発生するとデータが蓄積されます
            </p>
          )}
        </div>

        {/* variant 比較テーブル */}
        {abResult.totalClicks > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs font-semibold text-gray-500 mb-2">Variant 詳細比較</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Variant</th>
                    <th className="text-right pb-2 font-medium">クリック</th>
                    <th className="text-right pb-2 font-medium">購入</th>
                    <th className="text-right pb-2 font-medium">CVR</th>
                    <th className="text-right pb-2 font-medium">購入売上</th>
                    <th className="text-right pb-2 font-medium">アップセル率</th>
                    <th className="text-right pb-2 font-medium">アップセル売上</th>
                    <th className="text-right pb-2 font-medium">profit/click</th>
                  </tr>
                </thead>
                <tbody>
                  {(["A", "B"] as const).map((v) => {
                    const s        = abResult[v];
                    const isWinner = abResult.winner === v;
                    return (
                      <tr
                        key={v}
                        className={`border-b border-gray-50 ${isWinner ? "bg-emerald-50/60" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <span className={`font-bold ${isWinner ? "text-emerald-700" : "text-gray-700"}`}>
                            {v}
                            {isWinner && <span className="ml-1 text-[10px] text-emerald-600">★</span>}
                          </span>
                        </td>
                        <td className="text-right py-2 text-gray-700">{s.clicks}</td>
                        <td className="text-right py-2 text-gray-700">{s.purchases}</td>
                        <td className="text-right py-2 text-gray-700">
                          {s.clicks > 0 ? `${(s.cvr * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-right py-2 text-gray-700">
                          {s.totalAmount > 0 ? `¥${s.totalAmount.toLocaleString()}` : "—"}
                        </td>
                        <td className={`text-right py-2 ${s.upsellRate > 0 ? "text-amber-600 font-semibold" : "text-gray-400"}`}>
                          {s.purchases > 0 ? `${(s.upsellRate * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td className="text-right py-2 text-gray-700">
                          {s.upsellAmount > 0 ? `¥${s.upsellAmount.toLocaleString()}` : "—"}
                        </td>
                        <td className={`text-right py-2 font-bold ${isWinner ? "text-emerald-600" : "text-gray-600"}`}>
                          {s.clicks > 0 ? `¥${Math.round(s.profitPerClick).toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-300 mt-2">
              勝者判定: profit/click = (購入売上 + アップセル売上) / クリック数
            </p>
          </div>
        )}
      </div>

      {/* ── 優先対応顧客 ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">優先対応顧客</h3>
          {priorityCustomers.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {priorityCustomers.length}
            </span>
          )}
          <p className="text-xs text-gray-400 ml-auto">期限切れ → 温度感 → 新規登録 の順で上位3名</p>
        </div>

        {priorityCustomers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-300">優先対応が必要な顧客はいません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {priorityCustomers.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
              >
                {/* アバター */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-700">{(c.name || "?")[0]}</span>
                </div>

                {/* 名前 */}
                <div className="w-28 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900 leading-none">{c.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{c.display_name}</p>
                </div>

                {/* ステータス */}
                <div className="flex-shrink-0">
                  <StatusBadge status={c.status} />
                </div>

                {/* 危機度 */}
                <div className="flex-shrink-0">
                  <MiniCrisis level={c.crisis_level} />
                </div>

                {/* 次回アクション */}
                <div className="flex-1 min-w-0">
                  <ActionLabel date={c.next_action} />
                </div>

                {/* 対応ボタン */}
                <Link
                  href={`/customers/${c.id}`}
                  className="flex-shrink-0 text-xs font-medium text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  詳細へ →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 2カラム：ファネル概況 + 最近の購入 ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ファネル分布 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">ファネル分布</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            {funnelData.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.dotCls}`} />
                    <span className="text-xs text-gray-600">{f.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{f.count}名</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${f.dotCls}`}
                    style={{ width: f.count === 0 ? "0%" : `${Math.round((f.count / maxFunnelCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-300 pt-1">全 {customers.length} 名</p>
          </div>
        </div>

        {/* 最近の購入 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">最近の購入</h3>
            <Link href="/sales" className="text-xs text-brand-600 hover:underline">すべて見る</Link>
          </div>
          {recentSales.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-300">購入データなし</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentSales.map((s) => {
                const product = getProduct(s.type as ProductId);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    {/* 顧客アバター */}
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-brand-700">{(s.customer_name || "?")[0]}</span>
                    </div>
                    <span className="text-sm text-gray-700 w-20 flex-shrink-0 truncate">{s.customer_name}</span>

                    {/* 商品バッジ */}
                    {product ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${product.badgeClass}`}>
                        <span className={`w-1 h-1 rounded-full ${product.dotClass}`} />
                        {product.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 flex-shrink-0 truncate max-w-[80px]">{s.type}</span>
                    )}

                    <span className="flex-1" />

                    {/* 金額・支払 */}
                    <span className={`text-xs font-semibold flex-shrink-0 ${s.paid === 1 ? "text-gray-700" : "text-gray-300 line-through"}`}>
                      ¥{s.amount.toLocaleString()}
                    </span>
                    {s.paid !== 1 && (
                      <span className="text-[10px] text-red-500 font-medium flex-shrink-0">未収</span>
                    )}
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{s.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
