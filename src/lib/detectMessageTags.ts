// ─── LINE受信メッセージからの悩み系タグ自動検出 ──────────────
// tagMaster の "01_worry" グループに対応するキーワードマッピング。
// detectConcernTags（ヒアリング入力用）と同じ発想を LINE受信にも適用。
// 複数タグに同時マッチ可能。重複除去は caller 側で行う。

const WORRY_TAG_RULES: { tag: string; keywords: string[] }[] = [
  {
    tag:      "復縁",
    keywords: ["復縁", "元彼", "元カレ", "元彼氏", "元旦那", "元夫"],
  },
  {
    tag:      "片思い・進展",
    keywords: ["片思い", "好きな人", "告白", "進展", "脈あり", "脈なし"],
  },
  {
    tag:      "不倫・複雑愛",
    keywords: ["不倫", "複雑", "既婚", "奥さん", "旦那さん", "二股", "婚外"],
  },
  {
    tag:      "人間関係・仕事",
    keywords: ["仕事", "職場", "上司", "部下", "人間関係", "転職", "会社"],
  },
  {
    tag:      "金運・開運",
    keywords: ["お金", "金運", "収入", "開運", "運気", "宝くじ", "金銭"],
  },
];

/**
 * 受信テキストから悩み系タグを検出して返す。
 * 複数タグへの同時マッチが可能（全件チェック）。
 */
export function detectMessageTags(text: string): string[] {
  const detected: string[] = [];
  for (const { tag, keywords } of WORRY_TAG_RULES) {
    if (keywords.some((kw) => text.includes(kw))) {
      detected.push(tag);
    }
  }
  return detected;
}
