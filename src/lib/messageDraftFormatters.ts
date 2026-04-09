// ─── 送信文ドラフト コピー形式ヘルパー（Step 5-2）───────────
// line-tool 貼り付け用の「本文のみ」と、誤送信確認用の「メタ付き」の2種類。

/** ① line-tool に貼る用：本文だけ */
export function formatDraftTextOnly(text: string): string {
  return text.trim();
}

/** ② 誤送信確認用：顧客情報＋本文 */
export function formatDraftWithMeta(params: {
  customerName: string;
  customerId:   number | string;
  tags:         string[];
  text:         string;
}): string {
  const { customerName, customerId, tags, text } = params;

  return [
    `顧客名: ${customerName}`,
    `顧客ID: ${customerId}`,
    `タグ: ${tags.length ? tags.join(", ") : "なし"}`,
    "",
    "本文:",
    text.trim(),
  ].join("\n");
}
