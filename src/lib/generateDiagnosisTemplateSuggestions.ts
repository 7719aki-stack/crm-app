// ─── 鑑定テンプレ候補生成（ローカル） ───────────────────────────────────────
// 保存済み鑑定データ + タグ別固定候補 から「書き始め」「締め文」等を提案する。
// 断定的な鑑定結果を生成しない。人間が書く鑑定本文の土台強化が目的。
// 将来: diagnosisAssistant.ts 経由で Claude 実装に差し替え可能な形にしている。

import type { DiagnosisAssistInput, DiagnosisAssistSuggestion } from "@/lib/ai/diagnosisAssistant";
import type { DiagnosisRecord } from "@/lib/storage/diagnosisRecords";

// ── タグ別固定導入候補 ────────────────────────────────────────────────────────
const TAG_INTRO_HINTS: Record<string, string[]> = {
  "復縁": [
    "○○さんのお気持ち、拝察しました。",
    "お二人の縁について、しっかり視てまいります。",
  ],
  "片思い": [
    "○○さんの想いの深さ、伝わりました。",
    "相手の方との今の状況、丁寧に視てまいります。",
  ],
  "不倫": [
    "複雑な状況の中でのご相談、ありがとうございます。",
    "○○さんの置かれている状況を、真摯に視てまいります。",
  ],
  "結婚": [
    "ご縁や結婚の流れについて、視てまいります。",
    "お二人の将来の方向性を、しっかりお伝えします。",
  ],
  "仕事": [
    "○○さんの仕事運と今後の流れについて視ていきます。",
    "現状の状況と今後の動き方のヒントをお伝えします。",
  ],
  "金運": [
    "金銭的な流れと、今後の運気を視てまいります。",
    "お金の流れを整えるタイミングについてお伝えします。",
  ],
  "縁切り": [
    "○○さんを取り巻くご縁の状態、視てまいります。",
    "手放すべき縁と、残すべき縁について視ていきます。",
  ],
};

// ── 締め文候補（固定）──────────────────────────────────────────────────────
const FIXED_CLOSINGS = [
  "○○さんの歩む道が、より明るく開けていくことを願っています。",
  "どうかご自身を大切に、一歩一歩進んでいただければ幸いです。",
  "ご縁の流れを信じて、焦らず行動されることをおすすめします。",
  "何かご不安な点があれば、またいつでもご相談ください。",
  "○○さんの幸せを、心より応援しております。",
];

// ── 構成ヒント（固定）────────────────────────────────────────────────────────
const STRUCTURE_HINTS = [
  "①現状の確認 → ②相手の気持ち / 状況 → ③アドバイス・今後の展開",
  "①共感・受け止め → ②カード / 視えたこと → ③具体的なアドバイス",
  "①お気持ちへの共感 → ②鑑定で視えたこと → ③行動のヒント → ④締め",
];

// ── テキストから導入部（冒頭2文）を抽出 ───────────────────────────────────
function extractIntro(text: string): string {
  const sentences = text
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 60);
  return sentences.slice(0, 2).join("。") + (sentences.length > 0 ? "。" : "");
}

// ── テキストから締め部（末尾2文）を抽出 ───────────────────────────────────
function extractClosing(text: string): string {
  const sentences = text
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 80);
  return sentences.slice(-2).join("。") + (sentences.length > 0 ? "。" : "");
}

// ── 重複除去（先頭 20 文字で判定）────────────────────────────────────────
function dedup(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── メイン関数 ────────────────────────────────────────────────────────────────
export function generateDiagnosisTemplateSuggestions(
  input: DiagnosisAssistInput,
  records: DiagnosisRecord[]
): Omit<DiagnosisAssistSuggestion, "provider"> {
  const { tags = [] } = input;

  // 同タグの鑑定データを取得
  const sameTagRecords = records.filter((r) =>
    r.tags.some((t) => tags.includes(t))
  );

  // 導入候補: 過去鑑定の冒頭 + タグ固定
  const introFromHistory = sameTagRecords
    .slice(0, 5)
    .map((r) => extractIntro(r.text))
    .filter(Boolean);

  const introFromTags = tags.flatMap((t) => TAG_INTRO_HINTS[t] ?? []);

  const introSuggestions = dedup([...introFromHistory, ...introFromTags]).slice(0, 5);

  // 締め文候補: 過去鑑定の末尾 + 固定候補
  const closingFromHistory = sameTagRecords
    .slice(0, 5)
    .map((r) => extractClosing(r.text))
    .filter(Boolean);

  const closingSuggestions = dedup([...closingFromHistory, ...FIXED_CLOSINGS]).slice(0, 5);

  return {
    introSuggestions,
    structureSuggestions: STRUCTURE_HINTS,
    closingSuggestions,
    note: "現在はローカル提案モードです。保存済み鑑定データと固定テンプレから候補を生成しています。",
  };
}
