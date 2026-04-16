// ─── LINE返信意図判定 ────────────────────────────────────────────────────────
// 顧客の返信テキストから意図（positive / hold / unknown）を判定する。
// 部分一致 + trim + 小文字化で処理するため、全角・口語表現にも対応。

export type ReplyIntent = "positive" | "hold" | "unknown";

// ── キーワード定義 ────────────────────────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  "1", "①",
  "進めたい", "お願いします", "お願いしたい",
  "詳しく", "知りたい",
  "やります", "やりたい",
  "受けたい", "受けます",
  "はい", "お願い",
] as const;

const HOLD_KEYWORDS = [
  "2", "②",
  "考えたい", "考えます", "考えてみます",
  "迷ってる", "迷っています", "迷ってます",
  "検討", "あとで", "後で",
  "少し待って", "もう少し",
  "様子見", "様子をみ",
  "まだ", "保留",
] as const;

// ── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * 返信テキストから顧客の意図を判定する。
 *
 * - positive : 前向き・購入意思あり
 * - hold     : 検討中・保留
 * - unknown  : 判定不能（再質問を促す）
 */
export function resolveReplyIntent(input: string): ReplyIntent {
  const normalized = input.trim().toLowerCase();

  if (normalized === "") return "unknown";

  if (POSITIVE_KEYWORDS.some((kw) => normalized.includes(kw.toLowerCase()))) {
    return "positive";
  }

  if (HOLD_KEYWORDS.some((kw) => normalized.includes(kw.toLowerCase()))) {
    return "hold";
  }

  return "unknown";
}
