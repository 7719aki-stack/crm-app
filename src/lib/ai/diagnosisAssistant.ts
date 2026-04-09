// ─── AI 診断アシスタント（抽象レイヤー） ──────────────────────────────────────
// 現在: ローカル提案のみ（stub 実装）
// 将来: AI_CONFIG.provider === "claude" のとき Claude API を呼び出す実装に差し替える
// 呼び出し元（UI側）はこの関数だけを使う → service を変えても UI 変更不要

import { AI_CONFIG } from "./aiConfig";
import type { DiagnosisRecord } from "@/lib/storage/diagnosisRecords";

export type DiagnosisAssistInput = {
  tags: string[];
  concern?: string;
  pastDiagnosisTexts?: string[];
  interview?: {
    clientName?: string;
    birthDate?: string;
    concern?: string;
  };
};

export type DiagnosisAssistSuggestion = {
  introSuggestions: string[];
  structureSuggestions: string[];
  closingSuggestions: string[];
  note: string;
  provider: string;
};

// ── ローカル提案ロジック（外部API不使用）────────────────────────────────────
async function getLocalSuggestions(
  input: DiagnosisAssistInput,
  records: DiagnosisRecord[]
): Promise<DiagnosisAssistSuggestion> {
  const { generateDiagnosisTemplateSuggestions } = await import(
    "@/lib/generateDiagnosisTemplateSuggestions"
  );
  return {
    ...generateDiagnosisTemplateSuggestions(input, records),
    provider: "local",
  };
}

// ── 将来の Claude 接続口（現在は呼ばれない）─────────────────────────────────
// async function getClaudeSuggestions(
//   input: DiagnosisAssistInput
// ): Promise<DiagnosisAssistSuggestion> {
//   const res = await fetch("/api/ai/diagnosis-assist", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(input),
//   });
//   return res.json();
// }

// ── 公開エントリーポイント ────────────────────────────────────────────────────
export async function getDiagnosisAssistSuggestions(
  input: DiagnosisAssistInput,
  records: DiagnosisRecord[] = []
): Promise<DiagnosisAssistSuggestion> {
  if (AI_CONFIG.provider === "claude" && AI_CONFIG.enabled) {
    // 将来: return getClaudeSuggestions(input);
    throw new Error("Claude 接続は未実装です");
  }
  return getLocalSuggestions(input, records);
}
