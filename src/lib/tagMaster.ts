// ─── タグマスタ（Lステップ代替）─────────────────────────
// タグはグループ単位で管理。localStorage に保存してリロード後も維持。

export interface TagGroup {
  id:    string;
  label: string;
  tags:  string[];
}

export const DEFAULT_TAG_MASTER: TagGroup[] = [
  {
    id:    "01_worry",
    label: "01_悩み内容",
    tags:  ["金運・開運", "人間関係・仕事", "片思い・進展", "不倫・複雑愛", "復縁"],
  },
  {
    id:    "02_attribute",
    label: "02_基本属性",
    tags:  ["50代以上", "30〜40代", "20代以下", "男性", "女性"],
  },
  {
    id:    "03_action",
    label: "03_アクション履歴",
    tags:  [
      "鑑定待ち", "有料興味あり", "有料興味無し", "有料購入",
      "無料鑑定済み", "有料鑑定済み", "リピーター",
      "ココナラクリック済", "メルカリクリック済", "NOTEクリック済",
      "カルテ提出済", "X", "Threads", "Instagram",
    ],
  },
];

const LS_KEY = "crm_tag_master_v1";

export function loadTagMaster(): TagGroup[] {
  if (typeof window === "undefined") return DEFAULT_TAG_MASTER;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as TagGroup[]) : DEFAULT_TAG_MASTER;
  } catch {
    return DEFAULT_TAG_MASTER;
  }
}

export function saveTagMaster(groups: TagGroup[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(groups));
  } catch { /* QuotaExceededError 等は無視 */ }
}

/** 全グループからフラットなタグラベル一覧を返す */
export function getAllTagLabels(groups: TagGroup[]): string[] {
  return groups.flatMap((g) => g.tags);
}
