"use client";

import { useState } from "react";

type Props = {
  message:   string;
  /** 全置き換え */
  onUse?:    (text: string) => void;
  /** 末尾に追記 */
  onAppend?: (text: string) => void;
};

export default function OfferMessagePanel({ message, onUse, onAppend }: Props) {
  const [copied,   setCopied]   = useState(false);
  const [used,     setUsed]     = useState(false);
  const [appended, setAppended] = useState(false);

  if (!message) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 無視 */ }
  };

  const handleUse = () => {
    onUse?.(message);
    setUsed(true);
    setAppended(false);
  };

  const handleAppend = () => {
    onAppend?.(message);
    setAppended(true);
    setTimeout(() => setAppended(false), 1500);
  };

  return (
    <div
      className={`rounded-lg border px-3.5 py-3 transition-colors ${
        used ? "border-brand-300 bg-brand-50" : "border-emerald-200 bg-emerald-50"
      }`}
    >
      {/* ラベル */}
      <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full mb-2">
        案内文
      </span>

      {/* 本文 */}
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-2.5">
        {message}
      </p>

      {/* ボタン行 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 全置き換え */}
        {onUse && (
          <button
            onClick={handleUse}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              used
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:border-brand-400 hover:text-brand-600"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {used ? "✓ 使用中" : "置き換え"}
          </button>
        )}

        {/* 末尾追記 */}
        {onAppend && (
          <button
            onClick={handleAppend}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              appended
                ? "bg-sky-100 text-sky-700"
                : "bg-white border border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-600"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {appended ? "✓ 追記済" : "追記"}
          </button>
        )}

        {/* クリップボードコピー */}
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            copied
              ? "bg-emerald-100 text-emerald-700"
              : "bg-white border border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600"
          }`}
        >
          {copied ? (
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
}
