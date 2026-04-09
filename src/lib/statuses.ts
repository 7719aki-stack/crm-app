// ─── 顧客ステータス定義（恋愛鑑定ビジネス専用）──────────
// LINE連携・タグとの整合性を考慮して英語IDで管理

export type StatusId =
  | "new_reg"                  // 新規登録
  | "educating"                // 教育中
  | "divination_guided"        // 鑑定誘導済
  | "info_received"            // 鑑定情報受領
  | "free_sent"                // 無料鑑定送信済
  | "deep_guided"              // 深層誘導済
  | "paid_purchased"           // 有料鑑定購入済
  | "destiny_proposed"         // 運命修正提案済
  | "reversal_proposed"        // 逆転アクション提案済
  | "deep_psych_proposed"      // 深層心理提案済
  | "full_reversal_sounded"    // 完全逆転打診済
  | "full_reversal_purchased"  // 完全逆転購入済
  | "dormant"                  // 休眠
  | "churned";                 // 離脱

/** タグとの対応用エイリアス */
export type CustomerStatus = StatusId;

export type StatusGroup = "lead" | "divination" | "paid" | "upsell" | "exit";

export interface StatusDef {
  id:          StatusId;
  label:       string;
  group:       StatusGroup;
  /** テーブル・バッジ用のTailwindクラス（完全文字列でpurge対策） */
  badgeClass:  string;
  /** ドット表示用bg色クラス */
  dotClass:    string;
  order:       number;
}

// ─── ステータス一覧 ────────────────────────────────────
export const STATUSES: StatusDef[] = [
  // リード段階（青系: まだ関係構築中）
  { id: "new_reg",               label: "新規登録",           group: "lead",       order: 1,
    badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",        dotClass: "bg-blue-400" },
  { id: "educating",             label: "教育中",             group: "lead",       order: 2,
    badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",           dotClass: "bg-sky-400" },

  // 鑑定段階（シアン系: 鑑定フローに入っている）
  { id: "divination_guided",     label: "鑑定誘導済",         group: "divination", order: 3,
    badgeClass: "bg-teal-50 text-teal-700 border border-teal-200",        dotClass: "bg-teal-400" },
  { id: "info_received",         label: "鑑定情報受領",       group: "divination", order: 4,
    badgeClass: "bg-cyan-50 text-cyan-700 border border-cyan-200",        dotClass: "bg-cyan-400" },
  { id: "free_sent",             label: "無料鑑定送信済",     group: "divination", order: 5,
    badgeClass: "bg-cyan-100 text-cyan-800 border border-cyan-300",       dotClass: "bg-cyan-500" },

  // 有料転換（アンバー→緑: お金が動き始める）
  { id: "deep_guided",           label: "深層誘導済",         group: "paid",       order: 6,
    badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",     dotClass: "bg-amber-400" },
  { id: "paid_purchased",        label: "有料鑑定購入済",     group: "paid",       order: 7,
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200", dotClass: "bg-emerald-500" },

  // アップセル段階（紫系: 高単価への進行）
  { id: "destiny_proposed",      label: "運命修正提案済",     group: "upsell",     order: 8,
    badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",  dotClass: "bg-violet-500" },
  { id: "reversal_proposed",     label: "逆転アクション提案済", group: "upsell",   order: 9,
    badgeClass: "bg-purple-50 text-purple-700 border border-purple-200",  dotClass: "bg-purple-500" },
  { id: "deep_psych_proposed",   label: "深層心理提案済",     group: "upsell",     order: 10,
    badgeClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",  dotClass: "bg-indigo-500" },
  { id: "full_reversal_sounded", label: "完全逆転打診済",     group: "upsell",     order: 11,
    badgeClass: "bg-pink-50 text-pink-700 border border-pink-200",        dotClass: "bg-pink-500" },
  { id: "full_reversal_purchased", label: "完全逆転購入済",   group: "upsell",     order: 12,
    badgeClass: "bg-rose-100 text-rose-800 border border-rose-300",       dotClass: "bg-rose-500" },

  // 離脱（グレー・赤: アクティブでない）
  { id: "dormant",               label: "休眠",               group: "exit",       order: 13,
    badgeClass: "bg-gray-100 text-gray-500 border border-gray-200",       dotClass: "bg-gray-400" },
  { id: "churned",               label: "離脱",               group: "exit",       order: 14,
    badgeClass: "bg-red-50 text-red-600 border border-red-200",           dotClass: "bg-red-400" },
];

// ─── グループ定義 ────────────────────────────────────
export const STATUS_GROUPS: {
  group:     StatusGroup;
  label:     string;
  shortLabel: string;
  dotClass:  string;
}[] = [
  { group: "lead",       label: "リード段階", shortLabel: "リード",   dotClass: "bg-blue-400" },
  { group: "divination", label: "鑑定段階",   shortLabel: "鑑定",     dotClass: "bg-cyan-500" },
  { group: "paid",       label: "有料転換",   shortLabel: "有料",     dotClass: "bg-emerald-500" },
  { group: "upsell",     label: "アップセル", shortLabel: "アップセル", dotClass: "bg-violet-500" },
  { group: "exit",       label: "離脱",       shortLabel: "離脱",     dotClass: "bg-gray-400" },
];

// ─── ヘルパー ─────────────────────────────────────────
export const STATUS_MAP = new Map(STATUSES.map((s) => [s.id, s]));

export function getStatus(id: StatusId): StatusDef | undefined {
  return STATUS_MAP.get(id);
}

export function getStatusesByGroup(group: StatusGroup): StatusDef[] {
  return STATUSES.filter((s) => s.group === group);
}

/** タグIDとステータスIDの対応マップ（将来の自動化用） */
export const STATUS_TAG_MAP: Partial<Record<StatusId, string>> = {
  free_sent:               "free_done",
  paid_purchased:          "paid_purchased",
  destiny_proposed:        "destiny_fix",
  reversal_proposed:       "reversal_action",
  deep_psych_proposed:     "deep_psychology",
  full_reversal_sounded:   "full_reversal",
  full_reversal_purchased: "full_reversal",
  dormant:                 "dormant",
};
