// ─── キーワード自動応答ルール ─────────────────────────────
// 将来的に webhook 受信に差し替えやすいよう、判定ロジックを純粋関数に分離。
// UI・保存処理はコンポーネント側で行う。

export interface KeywordRule {
  id:            string;
  label:         string;    // 判定結果表示用ラベル
  keywords:      string[];  // いずれかが含まれれば一致
  addTags:       string[];  // 付与するタグ（既存なら無視）
  removeTags:    string[];  // 削除するタグ
  replyIntent:   string;    // 内部種別（将来のシナリオ分岐用）
  replyTemplate: string;    // 返信候補テキスト
}

export const KEYWORD_RULES: KeywordRule[] = [
  {
    id:          "diagnosis_request",
    label:       "鑑定リクエスト",
    keywords:    ["鑑定"],
    addTags:     ["鑑定待ち"],
    removeTags:  [],
    replyIntent: "diagnosis_request",
    replyTemplate:
      "ありがとうございます。\n鑑定希望ですね🌙\n必要な内容を確認したいので、このままいくつかお伺いします。",
  },
  {
    id:          "deep_interest",
    label:       "深層鑑定への興味",
    keywords:    ["深層"],
    addTags:     ["有料興味あり"],
    removeTags:  [],
    replyIntent: "deep_interest",
    replyTemplate:
      "ありがとうございます。\n深層鑑定に興味を持っていただけたのですね。\n内容をご案内しますので、このままご確認ください。",
  },
];

// ─── 判定結果 ──────────────────────────────────────────────

export interface MatchResult {
  /** マッチしたルール（なければ null） */
  rule:          KeywordRule | null;
  /** 実際に追加すべきタグ（既に持っているものは除外済み） */
  addedTags:     string[];
  /** 実際に削除すべきタグ（現在持っているものだけ） */
  removedTags:   string[];
  /** 返信候補テキスト（null = 候補なし） */
  replyCandidate: string | null;
}

/**
 * 受信テキストとキーワードルールを照合する。
 * 最初にマッチしたルールを採用する。
 *
 * @param text        受信メッセージ本文
 * @param currentTags 顧客が現在持っているタグ一覧
 */
export function detectKeywords(text: string, currentTags: string[]): MatchResult {
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return {
        rule,
        addedTags:     rule.addTags.filter((t) => !currentTags.includes(t)),
        removedTags:   rule.removeTags.filter((t) => currentTags.includes(t)),
        replyCandidate: rule.replyTemplate,
      };
    }
  }
  return { rule: null, addedTags: [], removedTags: [], replyCandidate: null };
}

/**
 * MatchResult を既存タグに適用して新しいタグ配列を返す。
 */
export function applyTagChanges(currentTags: string[], result: MatchResult): string[] {
  const set = new Set(currentTags);
  result.addedTags.forEach((t) => set.add(t));
  result.removedTags.forEach((t) => set.delete(t));
  return [...set];
}
