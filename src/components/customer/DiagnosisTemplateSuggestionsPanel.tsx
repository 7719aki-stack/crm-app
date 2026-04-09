"use client";

import { useState, useEffect } from "react";
import { AI_CONFIG } from "@/lib/ai/aiConfig";
import {
  getDiagnosisAssistSuggestions,
  type DiagnosisAssistInput,
  type DiagnosisAssistSuggestion,
} from "@/lib/ai/diagnosisAssistant";
import { getDiagnosisRecords } from "@/lib/storage/diagnosisRecords";

type Props = {
  customerId: number | string;
  tags: string[];
  concern?: string;
  /** 「鑑定本文欄へ追記」ボタン用コールバック（DiagnosisPanelは別管理なのでオプション） */
  onCopyToClipboard?: (text: string) => void;
};

type CopyState = Record<string, "idle" | "copied">;

export default function DiagnosisTemplateSuggestionsPanel({
  customerId,
  tags,
  concern,
  onCopyToClipboard,
}: Props) {
  const [suggestion, setSuggestion] = useState<DiagnosisAssistSuggestion | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [copyState,  setCopyState]  = useState<CopyState>({});

  async function loadSuggestions() {
    setLoading(true);
    const records = getDiagnosisRecords(); // 全件（タグフィルタはassistant内で行う）
    const input: DiagnosisAssistInput = {
      tags,
      concern,
      pastDiagnosisTexts: records.map((r) => r.text),
    };
    const result = await getDiagnosisAssistSuggestions(input, records);
    setSuggestion(result);
    setLoading(false);
  }

  // タグが変わったら再生成
  useEffect(() => {
    loadSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, tags.join(",")]);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((prev) => ({ ...prev, [key]: "copied" }));
      setTimeout(() => setCopyState((prev) => ({ ...prev, [key]: "idle" })), 2000);
      onCopyToClipboard?.(text);
    } catch { /* ignore */ }
  }

  const allEmpty =
    suggestion &&
    suggestion.introSuggestions.length === 0 &&
    suggestion.closingSuggestions.length === 0;

  return (
    <div className="space-y-4">
      {/* AI連携状態バッジ */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {AI_CONFIG.label}
        </span>
        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="text-[11px] text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
        >
          {loading ? "生成中…" : "再生成"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-brand-300 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && suggestion && (
        <div className="space-y-4">
          {/* 導入候補 */}
          {suggestion.introSuggestions.length > 0 && (
            <SuggestionGroup
              label="導入候補"
              items={suggestion.introSuggestions}
              copyState={copyState}
              onCopy={(i, text) => copyText(`intro_${i}`, text)}
            />
          )}

          {/* 構成ヒント */}
          <SuggestionGroup
            label="構成ヒント"
            items={suggestion.structureSuggestions}
            copyState={copyState}
            onCopy={(i, text) => copyText(`struct_${i}`, text)}
            muted
          />

          {/* 締め文候補 */}
          {suggestion.closingSuggestions.length > 0 && (
            <SuggestionGroup
              label="締め文候補"
              items={suggestion.closingSuggestions}
              copyState={copyState}
              onCopy={(i, text) => copyText(`closing_${i}`, text)}
            />
          )}

          {/* データ不足時 */}
          {allEmpty && (
            <p className="text-xs text-gray-400 leading-relaxed text-center py-4">
              鑑定データがまだありません。<br />
              鑑定本文を保存すると候補が増えます。
            </p>
          )}

          {/* AI接続ノート */}
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-[10px] text-amber-600 leading-relaxed">
              {suggestion.note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 候補グループ小コンポーネント ──────────────────────────────────────────────
function SuggestionGroup({
  label,
  items,
  copyState,
  onCopy,
  muted = false,
}: {
  label: string;
  items: string[];
  copyState: CopyState;
  onCopy: (index: number, text: string) => void;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
        {label}
      </p>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const key = `${label}_${i}`;
          const copied = copyState[key] === "copied";
          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 border transition-colors ${
                muted
                  ? "bg-gray-50 border-gray-100"
                  : "bg-white border-gray-100 hover:border-brand-100"
              }`}
            >
              <p className={`flex-1 text-xs leading-relaxed ${muted ? "text-gray-500" : "text-gray-700"}`}>
                {item}
              </p>
              <button
                onClick={() => onCopy(i, item)}
                className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-md transition-all ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                {copied ? "✓" : "コピー"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
