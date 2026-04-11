"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { STATUS_GROUPS, getStatus, type StatusGroup } from "@/lib/statuses";
import { loadTagMaster, type TagGroup } from "@/lib/tagMaster";
import {
  type CustomerRow,
  type Category,
  type Temperature,
  type CrisisLevel,
} from "./dummyData";

// ─── グループフィルタータブ ────────────────────────────
type GroupFilter = StatusGroup | "all";
const GROUP_TABS: { value: GroupFilter; label: string; dotClass: string }[] = [
  { value: "all",       label: "すべて",     dotClass: "bg-gray-400" },
  ...STATUS_GROUPS.map((g) => ({ value: g.group, label: g.shortLabel, dotClass: g.dotClass })),
];

// ─── カテゴリバッジカラー ──────────────────────────────
const CATEGORY_VARIANT: Record<Category, "purple" | "blue" | "green" | "yellow" | "gray" | "red"> = {
  片思い:   "purple",
  復縁:     "blue",
  不倫:     "red",
  婚活:     "green",
  複雑系:   "yellow",
  浮気確認: "gray",
};

// ─── 危機度ドットインジケーター ───────────────────────
const CRISIS_DOT: Record<CrisisLevel, string> = {
  1: "bg-gray-300",
  2: "bg-yellow-400",
  3: "bg-amber-400",
  4: "bg-orange-500",
  5: "bg-red-500",
};
const CRISIS_META: Record<CrisisLevel, { label: string; cls: string }> = {
  1: { label: "安定",   cls: "text-gray-400" },
  2: { label: "注意",   cls: "text-yellow-600" },
  3: { label: "要注意", cls: "text-amber-600" },
  4: { label: "危険",   cls: "text-orange-600" },
  5: { label: "緊急",   cls: "text-red-600" },
};

function CrisisIndicator({ level }: { level: CrisisLevel }) {
  const { label, cls } = CRISIS_META[level];
  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex gap-[3px]">
        {([1, 2, 3, 4, 5] as CrisisLevel[]).map((i) => (
          <div
            key={i}
            className={`w-[7px] h-[7px] rounded-full ${i <= level ? CRISIS_DOT[level] : "bg-gray-100"}`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

// ─── 温度感バッジ ──────────────────────────────────────
const TEMP_CONFIG: Record<Temperature, { emoji: string; label: string; cls: string }> = {
  cold: { emoji: "❄️", label: "冷え気味", cls: "bg-blue-50  text-blue-600  border border-blue-100" },
  cool: { emoji: "🌤",  label: "普通",    cls: "bg-gray-100 text-gray-500  border border-gray-200" },
  warm: { emoji: "☀️", label: "温まり中", cls: "bg-amber-50 text-amber-600 border border-amber-100" },
  hot:  { emoji: "🔥", label: "熱い",     cls: "bg-red-50   text-red-600   border border-red-100" },
};

function TemperatureBadge({ temp }: { temp: Temperature }) {
  const { emoji, label, cls } = TEMP_CONFIG[temp];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <span className="text-[11px] leading-none">{emoji}</span>
      {label}
    </span>
  );
}

// ─── 次回アクション日 ──────────────────────────────────
function ActionDateCell({ date }: { date: string | null }) {
  if (!date) {
    return <span className="text-xs text-gray-300">未設定</span>;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        {date} <span className="font-normal text-red-400">({Math.abs(diffDays)}日超過)</span>
      </span>
    );
  }
  if (diffDays === 0) return <span className="text-xs font-semibold text-orange-600">今日</span>;
  if (diffDays === 1) return <span className="text-xs font-medium text-amber-600">明日 ({date})</span>;
  if (diffDays <= 3)  return <span className="text-xs text-yellow-600">{date}</span>;
  return <span className="text-xs text-gray-500">{date}</span>;
}

// ─── タグカラー（ハッシュベース）─────────────────────
const TAG_VARIANTS = ["purple", "blue", "green", "yellow", "gray", "red"] as const;
type BadgeVariant = typeof TAG_VARIANTS[number];
function tagVariant(tag: string): BadgeVariant {
  const hash = [...tag].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return TAG_VARIANTS[hash % TAG_VARIANTS.length];
}

// ─── サマリーカード ───────────────────────────────────
function SummaryCards({ data }: { data: CustomerRow[] }) {
  const vip    = data.filter((c) => getStatus(c.status)?.group === "upsell").length;
  const active = data.filter((c) => getStatus(c.status)?.group !== "exit").length;
  const overdue  = data.filter((c) => {
    if (!c.next_action) return false;
    return new Date(c.next_action) < new Date();
  }).length;
  const revenue  = data.reduce((sum, c) => sum + c.total_amount, 0);

  const cards = [
    { label: "顧客総数",        value: data.length, unit: "名",  color: "text-gray-800",    bg: "bg-white" },
    { label: "アクティブ",      value: active,      unit: "名",  color: "text-emerald-700",  bg: "bg-emerald-50" },
    { label: "VIP顧客",         value: vip,         unit: "名",  color: "text-brand-700",    bg: "bg-brand-50" },
    { label: "要フォロー",      value: overdue,     unit: "件",  color: "text-red-600",      bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} rounded-xl border border-gray-100 px-4 py-3`}>
          <p className="text-xs text-gray-400 mb-1">{c.label}</p>
          <p className={`text-xl font-bold ${c.color}`}>
            {c.value}
            <span className="text-sm font-normal ml-0.5">{c.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── タグ絞り込みパネル ───────────────────────────────
function TagFilterPanel({
  groups,
  selectedTags,
  onToggle,
  onClear,
}: {
  groups:       TagGroup[];
  selectedTags: string[];
  onToggle:     (tag: string) => void;
  onClear:      () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            open || selectedTags.length > 0
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a0 0 0 014-4z" />
          </svg>
          タグ絞り込み
          {selectedTags.length > 0 && (
            <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {selectedTags.length}
            </span>
          )}
        </button>

        {/* 選択中タグ */}
        {selectedTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors"
          >
            {tag}
            <span className="opacity-60">×</span>
          </button>
        ))}
        {selectedTags.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            すべて解除
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
          {groups.map(({ id, label, tags }) => (
            <div key={id}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                {label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggle(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        active
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────
export function CustomerList() {
  const [customers,    setCustomers]    = useState<CustomerRow[]>([]);
  const [tagGroups,    setTagGroups]    = useState<TagGroup[]>([]);
  const [filterGroup,  setFilterGroup]  = useState<GroupFilter>("all");
  const [searchText,   setSearchText]   = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    // DB から顧客データを取得
    fetch("/api/customers")
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) setCustomers(data as CustomerRow[]);
        else console.error("[CustomerList] unexpected response:", data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // タグマスタを読み込む
    setTagGroups(loadTagMaster());
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const filtered = customers.filter((c) => {
    if (filterGroup !== "all" && getStatus(c.status)?.group !== filterGroup) return false;
    if (selectedTags.length > 0 && !selectedTags.every((t) => c.tags.includes(t))) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.display_name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div />
        <button
          disabled
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg opacity-50 cursor-not-allowed"
          title="次フェーズで実装"
        >
          <span className="text-base leading-none">+</span>
          新規顧客を追加
        </button>
      </div>

      {/* サマリーカード */}
      <SummaryCards data={customers} />

      {/* 検索 & ステータスフィルター */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="名前・タグ・カテゴリで検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {GROUP_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterGroup(tab.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterGroup === tab.value
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tab.dotClass}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* タグ絞り込みパネル */}
      {tagGroups.length > 0 && (
        <TagFilterPanel
          groups={tagGroups}
          selectedTags={selectedTags}
          onToggle={toggleTag}
          onClear={() => setSelectedTags([])}
        />
      )}

      {/* テーブル */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
          <p className="text-sm text-gray-300">読み込み中...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
          <p className="text-sm text-gray-300">顧客データがありません</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
          <p className="text-sm text-gray-300">条件に一致する顧客が見つかりませんでした</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1080px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    { label: "ID",           w: "w-12" },
                    { label: "顧客名",       w: "w-44" },
                    { label: "カテゴリ",     w: "w-24" },
                    { label: "ステータス",   w: "w-20" },
                    { label: "登録日",       w: "w-24" },
                    { label: "タグ",         w: "w-52" },
                    { label: "危機度",       w: "w-20" },
                    { label: "温度感",       w: "w-24" },
                    { label: "最終接触",     w: "w-24" },
                    { label: "次回アクション", w: "w-32" },
                    { label: "累計購入額",   w: "w-24" },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`${col.w} text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <CustomerTableRow key={c.id} customer={c} highlightTags={selectedTags} />
                ))}
              </tbody>
            </table>
          </div>

          {/* フッター */}
          <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              {filtered.length} 件表示
              {filtered.length !== customers.length && ` / 全 ${customers.length} 件`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── テーブル行 ───────────────────────────────────────
function CustomerTableRow({
  customer: c,
  highlightTags,
}: {
  customer:      CustomerRow;
  highlightTags: string[];
}) {
  const router = useRouter();
  const isHighRisk = c.crisis_level >= 4;

  return (
    <tr
      onClick={() => router.push(`/customers/${c.id}`)}
      className={`group transition-colors cursor-pointer
        ${isHighRisk ? "bg-red-50/30 hover:bg-red-50/60" : "hover:bg-brand-50/40"}
      `}
    >
      {/* ID */}
      <td className="px-4 py-3.5 text-xs text-gray-300 font-mono">#{c.id}</td>

      {/* 顧客名 */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-200 to-pink-200 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-brand-700">{(c.display_name || c.name)[0]}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-[13px] leading-none">{c.display_name || c.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-none">{c.name}</p>
          </div>
        </div>
      </td>

      {/* カテゴリ */}
      <td className="px-4 py-3.5">
        <Badge variant={CATEGORY_VARIANT[c.category]} size="sm">{c.category}</Badge>
      </td>

      {/* ステータス */}
      <td className="px-4 py-3.5">
        <StatusBadge status={c.status} />
      </td>

      {/* 登録日 */}
      <td className="px-4 py-3.5">
        <span className="text-xs text-gray-500">{c.created_at ?? "—"}</span>
      </td>

      {/* タグ */}
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1">
          {c.tags.map((tag) => (
            <Badge
              key={tag}
              variant={highlightTags.includes(tag) ? "purple" : tagVariant(tag)}
              size="sm"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </td>

      {/* 危機度 */}
      <td className="px-4 py-3.5">
        <CrisisIndicator level={c.crisis_level} />
      </td>

      {/* 温度感 */}
      <td className="px-4 py-3.5">
        <TemperatureBadge temp={c.temperature} />
      </td>

      {/* 最終接触日 */}
      <td className="px-4 py-3.5">
        <span className="text-xs text-gray-500">{c.last_contact}</span>
      </td>

      {/* 次回アクション */}
      <td className="px-4 py-3.5">
        <ActionDateCell date={c.next_action} />
      </td>

      {/* 累計購入額 */}
      <td className="px-4 py-3.5 text-right pr-5">
        {c.total_amount === 0 ? (
          <span className="text-xs text-gray-300">—</span>
        ) : (
          <span className={`text-xs font-semibold ${c.total_amount >= 50000 ? "text-brand-600" : "text-gray-700"}`}>
            ¥{c.total_amount.toLocaleString()}
          </span>
        )}
      </td>
    </tr>
  );
}
