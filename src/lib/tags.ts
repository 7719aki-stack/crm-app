// ─── タグ定義（恋愛鑑定ビジネス専用）─────────────────────
// LINE連携対応を考慮して英語IDで管理、表示は日本語ラベル

export type TagId =
  | "unreviewed"       // 未鑑定
  | "waiting"          // 鑑定待ち
  | "free_done"        // 無料鑑定済
  | "paid_interest"    // 有料興味
  | "paid_purchased"   // 有料購入
  | "destiny_fix"      // 運命修正対象
  | "reversal_action"  // 逆転アクション対象
  | "deep_psychology"  // 深層心理対象
  | "full_reversal"    // 完全逆転候補
  | "dormant";         // 休眠

export type TagGroup = "funnel" | "upsell" | "status";

export interface TagDef {
  id:           TagId;
  label:        string;
  group:        TagGroup;
  /** アクティブ時のTailwindクラス（完全な文字列でパージ対策） */
  activeClass:  string;
  /** パレット上のドット色 */
  dotClass:     string;
}

// ─── タグ定義一覧 ──────────────────────────────────────
export const TAGS = [
  // ファネル段階（顧客の現在地）
  {
    id:          "unreviewed"      as TagId,
    label:       "未鑑定",
    group:       "funnel"          as TagGroup,
    activeClass: "bg-slate-500 text-white",
    dotClass:    "bg-slate-400",
  },
  {
    id:          "waiting"         as TagId,
    label:       "鑑定待ち",
    group:       "funnel"          as TagGroup,
    activeClass: "bg-blue-500 text-white",
    dotClass:    "bg-blue-400",
  },
  {
    id:          "free_done"       as TagId,
    label:       "無料鑑定済",
    group:       "funnel"          as TagGroup,
    activeClass: "bg-cyan-500 text-white",
    dotClass:    "bg-cyan-400",
  },
  {
    id:          "paid_interest"   as TagId,
    label:       "有料興味",
    group:       "funnel"          as TagGroup,
    activeClass: "bg-amber-400 text-white",
    dotClass:    "bg-amber-400",
  },
  {
    id:          "paid_purchased"  as TagId,
    label:       "有料購入",
    group:       "funnel"          as TagGroup,
    activeClass: "bg-emerald-500 text-white",
    dotClass:    "bg-emerald-400",
  },
  // アップセル対象（提案可能なサービス）
  {
    id:          "destiny_fix"     as TagId,
    label:       "運命修正対象",
    group:       "upsell"          as TagGroup,
    activeClass: "bg-violet-500 text-white",
    dotClass:    "bg-violet-400",
  },
  {
    id:          "reversal_action" as TagId,
    label:       "逆転アクション対象",
    group:       "upsell"          as TagGroup,
    activeClass: "bg-pink-500 text-white",
    dotClass:    "bg-pink-400",
  },
  {
    id:          "deep_psychology" as TagId,
    label:       "深層心理対象",
    group:       "upsell"          as TagGroup,
    activeClass: "bg-indigo-500 text-white",
    dotClass:    "bg-indigo-400",
  },
  {
    id:          "full_reversal"   as TagId,
    label:       "完全逆転候補",
    group:       "upsell"          as TagGroup,
    activeClass: "bg-rose-500 text-white",
    dotClass:    "bg-rose-400",
  },
  // 状態
  {
    id:          "dormant"         as TagId,
    label:       "休眠",
    group:       "status"          as TagGroup,
    activeClass: "bg-gray-400 text-white",
    dotClass:    "bg-gray-400",
  },
] satisfies TagDef[];

// ─── グループ定義 ──────────────────────────────────────
export const TAG_GROUPS: { group: TagGroup; label: string }[] = [
  { group: "funnel",  label: "ファネル段階" },
  { group: "upsell",  label: "アップセル対象" },
  { group: "status",  label: "状態" },
];

// ─── ヘルパー ──────────────────────────────────────────
export const TAG_MAP = new Map(TAGS.map((t) => [t.id, t]));

export function getTag(id: TagId): TagDef | undefined {
  return TAG_MAP.get(id);
}

export function getTagsByGroup(group: TagGroup): TagDef[] {
  return TAGS.filter((t) => t.group === group);
}

/** LINE Webhookなどの外部連携用にタグIDリストをシリアライズ */
export function serializeTags(tags: TagId[]): string {
  return tags.join(",");
}

/** 外部から受け取ったカンマ区切り文字列をTagId[]に変換 */
export function parseTags(raw: string): TagId[] {
  const validIds = new Set(TAGS.map((t) => t.id));
  return raw.split(",").filter((s): s is TagId => validIds.has(s as TagId));
}
