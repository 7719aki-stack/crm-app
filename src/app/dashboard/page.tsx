// ダッシュボード（Supabase実データ）
export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/db";
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
  let monthRevenue    = 0;
  let monthPaidCount  = 0;
  let recentSales: {
    id: number;
    customer_name: string;
    type: string;
    amount: number;
    paid: number;
    date: string;
  }[] = [];

  try {
    // 顧客一覧
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

    // 今月売上（appraisals から集計）
    const now = new Date();
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: thisMonthAppraisals } = await supabase
      .from("appraisals")
      .select("price, paid")
      .gte("created_at", monthStart)
      .lt("created_at", nextMonthStart);

    const paid = (thisMonthAppraisals ?? []).filter((a) => a.paid === 1);
    monthRevenue   = paid.reduce((s, a) => s + (a.price ?? 0), 0);
    monthPaidCount = paid.length;

    // 最近の購入（直近5件）
    const { data: salesData } = await supabase
      .from("appraisals")
      .select("id, type, price, paid, created_at, customers(name)")
      .order("created_at", { ascending: false })
      .limit(5);

    recentSales = (salesData ?? []).map((a) => ({
      id:            a.id,
      customer_name: (a.customers as { name: string } | null)?.name ?? "不明",
      type:          a.type,
      amount:        a.price ?? 0,
      paid:          a.paid,
      date:          String(a.created_at).slice(0, 10),
    }));
  } catch (e) {
    console.error("[DashboardPage] DB error:", e);
  }

  // ─── 集計 ─────────────────────────────────────────────
  const leadCount       = customers.filter((c) => getStatus(c.status)?.group === "lead").length;
  const divinationCount = customers.filter((c) => getStatus(c.status)?.group === "divination").length;
  const preConvertCount = customers.filter((c) => c.status === "deep_guided").length;
  const purchasedCount  = customers.filter(
    (c) => c.status === "paid_purchased" || getStatus(c.status)?.group === "upsell"
  ).length;

  const priorityCustomers: CustomerRow[] = customers
    .filter((c) => {
      if (getStatus(c.status)?.group === "exit") return false;
      const overdue  = c.next_action && new Date(c.next_action) <= tomorrow;
      const highRisk = c.crisis_level >= 4;
      return overdue || highRisk;
    })
    .sort((a, b) => {
      const aOverdue = a.next_action && new Date(a.next_action) < today;
      const bOverdue = b.next_action && new Date(b.next_action) < today;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return  1;
      return b.crisis_level - a.crisis_level;
    });

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
            label: "新規顧客",
            sublabel: "リード段階",
            value: leadCount,
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
            sublabel: "購入〜アップセル",
            value: purchasedCount,
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

      {/* ── 優先対応顧客 ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">優先対応顧客</h3>
          {priorityCustomers.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {priorityCustomers.length}
            </span>
          )}
          <p className="text-xs text-gray-400 ml-auto">危機度4以上 / 次回アクション期限</p>
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
                  対応する →
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
