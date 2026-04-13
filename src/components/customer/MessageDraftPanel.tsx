"use client";

import { useState, useEffect } from "react";
import {
  formatDraftTextOnly,
  formatDraftWithMeta,
} from "@/lib/messageDraftFormatters";

type Props = {
  customerName: string;
  customerId:   number | string;
  tags:         string[];
  value:        string;
  onChange:     (text: string) => void;
  /** LINE送信パネルで選択中のトーン */
  tone?:        string;
  /** LINEユーザーID（未設定の場合は undefined） */
  lineUserId?:  string;
};

type CopyState = "idle" | "copied";

export default function MessageDraftPanel({
  customerName,
  customerId,
  tags,
  value,
  onChange,
  tone,
  lineUserId,
}: Props) {
  const [copyText, setCopyText] = useState<CopyState>("idle");
  const [copyMeta, setCopyMeta] = useState<CopyState>("idle");
  const [cleared,  setCleared]  = useState(false);

  useEffect(() => {
    if (value) setCleared(false);
  }, [value]);

  const hasText = value.trim().length > 0;
  const isReady = value.length >= 20 && value.includes("\n");

  async function copyToClipboard(content: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      return false;
    }
  }

  const handleCopyText = async () => {
    if (!hasText) return;
    const ok = await copyToClipboard(formatDraftTextOnly(value));
    if (ok) {
      setCopyText("copied");
      setTimeout(() => setCopyText("idle"), 2000);
    }
  };

  const handleCopyMeta = async () => {
    if (!hasText) return;
    const ok = await copyToClipboard(
      formatDraftWithMeta({ customerName, customerId, tags, text: value })
    );
    if (ok) {
      setCopyMeta("copied");
      setTimeout(() => setCopyMeta("idle"), 2000);
    }
  };

  const handleClear = () => {
    onChange("");
    setCleared(true);
    setTimeout(() => setCleared(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* ── 宛先メタ情報 ─────────────────────────────── */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-10 shrink-0">
            宛先
          </span>
          <span className="text-xs font-semibold text-gray-800">{customerName}</span>
          <span className="text-[10px] text-gray-400 font-mono">#{customerId}</span>
        </div>
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-10 shrink-0">
              タグ
            </span>
            {tags.map((t) => (
              <span
                key={t}
                className="text-[10px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded-full"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 送信準備状態バッジ ────────────────────────── */}
      <div className="flex items-center gap-2">
        {hasText ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
              isReady
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-amber-50 text-amber-600 border-amber-200"
            }`}
          >
            {isReady ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                送信準備OK
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                未完成
              </>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-gray-300">文面を入力してください</span>
        )}
        {hasText && !isReady && (
          <span className="text-[10px] text-gray-300">20文字以上・改行を含めてください</span>
        )}
      </div>

      {/* ── ドラフト textarea ─────────────────────────── */}
      <div>
        {/* 送信前チェック */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-2">
          {/* 宛先 */}
          <span className="inline-flex items-center gap-1 text-[10px]">
            {lineUserId ? (
              <>
                <span className="text-emerald-500 font-bold">✔</span>
                <span className="text-gray-400">宛先：</span>
                <span className="text-gray-600 font-medium font-mono truncate max-w-[120px]">{lineUserId}</span>
              </>
            ) : (
              <>
                <span className="text-amber-400">⚠</span>
                <span className="text-gray-400">宛先：</span>
                <span className="text-amber-500 font-medium">LINE ID未設定</span>
              </>
            )}
          </span>
          {/* トーン */}
          <span className="inline-flex items-center gap-1 text-[10px]">
            <span className="text-emerald-500 font-bold">✔</span>
            <span className="text-gray-400">トーン：</span>
            <span className="text-gray-600 font-medium">{tone ?? "—"}</span>
          </span>
          {/* 文面 */}
          <span className="inline-flex items-center gap-1 text-[10px]">
            {value.trim().length > 0 ? (
              <>
                <span className="text-emerald-500 font-bold">✔</span>
                <span className="text-gray-400">文面：</span>
                <span className="text-gray-600 font-medium">入力済み</span>
              </>
            ) : (
              <>
                <span className="text-gray-300">⚠</span>
                <span className="text-gray-300">文面：</span>
                <span className="text-gray-300">未入力</span>
              </>
            )}
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          placeholder="送信文をここで整えます&#10;返信候補・案内文から「置き換え」「追記」で追加するか、直接入力してください"
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none placeholder:text-gray-300"
        />
      </div>

      {/* ── 文字数 ───────────────────────────────────── */}
      <p className="text-[10px] text-gray-300 text-right -mt-1">
        {value.length > 0 ? `${value.length} 文字` : ""}
      </p>

      {/* ── コピーボタン ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">

          {/* ① 本文のみコピー（line-tool 用メイン） */}
          <button
            onClick={handleCopyText}
            disabled={!hasText}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              copyText === "copied"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            {copyText === "copied" ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                コピー済み ✓
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                本文のみコピー
              </>
            )}
          </button>

          {/* ② 確認付きコピー（誤送信防止用） */}
          <button
            onClick={handleCopyMeta}
            disabled={!hasText}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              copyMeta === "copied"
                ? "bg-sky-100 text-sky-700 border border-sky-200"
                : "bg-white border border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-600"
            }`}
          >
            {copyMeta === "copied" ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                コピー済み ✓
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                確認付きコピー
              </>
            )}
          </button>

          {/* クリア（右端に離して誤爆防止） */}
          <div className="ml-auto">
            <button
              onClick={handleClear}
              disabled={!hasText}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                cleared
                  ? "text-gray-400"
                  : "text-gray-300 hover:text-red-400 hover:bg-red-50 border border-transparent hover:border-red-100"
              }`}
            >
              {cleared ? (
                "クリア済"
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  クリア
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── 操作フロー + 送信画面ボタン ─────────────── */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 space-y-2">
          {/* フロー */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-blue-400 font-semibold">① 返信作成</span>
            <span className="text-[10px] text-blue-300">→</span>
            <span className="text-[10px] text-blue-400 font-semibold">② 本文コピー</span>
            <span className="text-[10px] text-blue-300">→</span>
            <span className="text-[10px] text-blue-600 font-bold">③ 送信画面を開く</span>
            <span className="text-[10px] text-blue-300">→</span>
            <span className="text-[10px] text-blue-400 font-semibold">④ 貼り付け・送信</span>
          </div>

          {/* 送信画面を開くボタン */}
          <button
            onClick={() => window.open("http://localhost:3100", "_blank")}
            className="w-full inline-flex items-center justify-center gap-2 text-base font-bold px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            送信画面を開く（次へ進む）
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
