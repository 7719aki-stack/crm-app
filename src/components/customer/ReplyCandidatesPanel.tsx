"use client";

import { useState, useEffect } from "react";

type Props = {
  candidates: string[];
  /** 全置き換え */
  onSelect?:  (text: string) => void;
  /** 末尾に追記 */
  onAppend?:  (text: string) => void;
  /** この index 以降のアイテムを「提案文」としてバッジ表示する */
  salesStartIndex?: number;
};

/** 候補テキスト先頭の【ラベル】を抽出。なければ「候補 N」を返す */
function extractLabel(text: string, index: number): string {
  const match = text.match(/^【(.+?)】/);
  return match ? match[1] : `候補 ${index + 1}`;
}

export default function ReplyCandidatesPanel({ candidates, onSelect, onAppend, salesStartIndex }: Props) {
  const [copiedIndex,   setCopiedIndex]   = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [appendedIndex, setAppendedIndex] = useState<number | null>(null);

  // 候補リストが変わったら全ハイライト・フラグをリセット
  useEffect(() => {
    setSelectedIndex(null);
    setAppendedIndex(null);
    setCopiedIndex(null);
  }, [candidates]);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      alert("コピー失敗");
    }
  };

  const handleSelect = (text: string, index: number) => {
    onSelect?.(text);
    setSelectedIndex(index);
    setAppendedIndex(null);
  };

  const handleAppend = (text: string, index: number) => {
    onAppend?.(text);
    setAppendedIndex(index);
    setSelectedIndex(index);
    setTimeout(() => setAppendedIndex(null), 1500);
  };

  const selectedLabel =
    selectedIndex !== null ? extractLabel(candidates[selectedIndex], selectedIndex) : null;

  return (
    <div className="space-y-2.5">
      {/* 現在選択中バナー */}
      {selectedLabel !== null ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
          <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-semibold text-purple-700">
            現在選択中：{selectedLabel}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-xs text-gray-400">
            「置き換え」または「追記」で候補を選択してください
          </span>
        </div>
      )}

      {candidates.map((text, i) => {
        const isSelected = selectedIndex === i;
        const isSales = salesStartIndex !== undefined && i >= salesStartIndex;
        return (
          <div
            key={i}
            className={`relative rounded-lg px-3.5 py-3 transition-all ${
              isSelected
                ? "border-2 border-purple-500 bg-purple-50 shadow-md"
                : isSales
                ? "border border-amber-200 bg-amber-50"
                : "border border-gray-200 bg-white"
            }`}
          >
            {/* 選択中チェックマーク（右上） */}
            {isSelected && (
              <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-500">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}

            {isSales && !isSelected && (
              <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full mb-2">
                提案文
              </span>
            )}
            {isSales && isSelected && (
              <span className="inline-block text-[10px] font-semibold text-purple-600 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded-full mb-2">
                提案文（選択中）
              </span>
            )}

            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-2.5 pr-6">
              {text}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 全置き換え */}
              {onSelect && (
                <button
                  onClick={() => handleSelect(text, i)}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    isSelected
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600"
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  {isSelected ? "✓ 使用中" : "置き換え"}
                </button>
              )}

              {/* 末尾追記 */}
              {onAppend && (
                <button
                  onClick={() => handleAppend(text, i)}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    appendedIndex === i
                      ? "bg-sky-100 text-sky-700"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-600"
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {appendedIndex === i ? "✓ 追記済" : "追記"}
                </button>
              )}

              {/* クリップボードコピー */}
              <button
                onClick={() => handleCopy(text, i)}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  copiedIndex === i
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600"
                }`}
              >
                {copiedIndex === i ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    コピー済
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    コピー
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
