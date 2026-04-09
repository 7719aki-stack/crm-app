// ─── AI 接続設定 ──────────────────────────────────────────────────────────────
// 現在: disabled（ローカル提案モード）
// 将来: provider を "claude" に変えて diagnosisAssistant.ts を差し替える

export type AiProvider = "disabled" | "claude";

export const AI_CONFIG = {
  provider: "disabled" as AiProvider,
  enabled: false,
  label: "ローカル提案モード",
} as const;
