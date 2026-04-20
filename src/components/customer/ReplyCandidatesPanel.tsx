"use client";

import { useState, useEffect, useRef } from "react";

type SendStatus = "idle" | "sending" | "sent" | "error";

type Props = {
  candidates: string[];
  /** 全置き換え（送信文エリアへのセット） */
  onSelect?:  (text: string) => void;
  /** 末尾に追記 */
  onAppend?:  (text: string) => void;
  /** この index 以降のアイテムを「提案文」としてバッジ表示する */
  salesStartIndex?: number;
  /** クリック即保存（messages/local を呼ぶ） */
  onSendDirect?: (text: string) => Promise<void>;
};

/** 候補テキスト先頭の【ラベル】を抽出。なければ「候補 N」を返す */
function extractLabel(text: string, index: number): string {
  const match = text.match(/^【(.+?)】/);
  return match ? match[1] : `候補 ${index + 1}`;
}

export default function ReplyCandidatesPanel({ candidates, onSelect, onAppend, salesStartIndex, onSendDirect }: Props) {
  const [copiedIndex,   setCopiedIndex]   = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [appendedIndex, setAppendedIndex] = useState<number | null>(null);
  const [sendStatus,    setSendStatus]    = useState<SendStatus>("idle");
  const [sendError,     setSendError]     = useState<string | null>(null);

  // onSelect を ref に同期して useEffect 内の stale closure を回避する
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });

  // 候補リストが変わったら最初の候補を自動選択し textarea に反映する
  useEffect(() => {
    setCopiedIndex(null);
    setAppendedIndex(null);
    setSendStatus("idle");
    setSendError(null);
    if (candidates.length > 0) {
      setSelectedIndex(0);
      onSelectRef.current?.(candidates[0]);
    } else {
      setSelectedIndex(null);
    }
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
    setSendStatus("idle");
    setSendError(null);
  };

  const handleAppend = (text: string, index: number) => {
    onAppend?.(text);
    setAppendedIndex(index);
    setSelectedIndex(index);
    setTimeout(() => setAppendedIndex(null), 1500);
  };

  // メイン候補の「クリック即送信」ハンドラ
  const handleSendDirect = async (text: string) => {
    if (sendStatus === "sending") return;
    // 送信文エリアにもセット
    onSelect?.(text);
    if (!onSendDirect) return;
    setSendStatus("sending");
    setSendError(null);
    try {
      await onSendDirect(text);
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "送信に失敗しました");
      setSendStatus("error");
      setTimeout(() => setSendStatus("idle"), 4000);
    }
  };

  if (candidates.length === 0) return null;

  // メイン候補 = 選択中。サブ候補 = それ以外
  const mainIndex = selectedIndex ?? 0;
  const mainText  = candidates[mainIndex];
  const mainLabel = extractLabel(mainText, mainIndex);
  const isSalesMain = salesStartIndex !== undefined && mainIndex >= salesStartIndex;

  const subCandidates = candidates
    .map((text, i) => ({ text, i }))
    .filter(({ i }) => i !== mainIndex);

  // メイン送信ボタンのスタイルと文言
  const directBtnCls = sendStatus === "sending"
    ? "bg-gray-400 text-white cursor-not-allowed"
    : sendStatus === "sent"
    ? "bg-emerald-500 text-white"
    : sendStatus === "error"
    ? "bg-red-500 text-white"
    : onSendDirect
    ? "bg-green-600 text-white hover:bg-green-700 active:bg-green-800"
    : "bg-green-600 text-white hover:bg-green-700 active:bg-green-800";

  return (
    <div className="space-y-3">

      {/* ── メイン候補（大きく・強調） ───────────────────── */}
      <div className="relative rounded-xl border-2 border-purple-500 bg-purple-50 shadow-md px-4 py-3.5">

        {/* 右上「おすすめ」バッジ */}
        <span className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
          おすすめ
        </span>

        {/* ラベル行（左上） */}
        <div className="flex items-center gap-1.5 mb-2.5 pr-20">
          <span className="text-[10px] font-semibold text-purple-500">{mainLabel}</span>
          {isSalesMain && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
              提案文
            </span>
          )}
        </div>

        {/* おすすめ理由 */}
        <p className="text-sm text-gray-600 mt-2 mb-2">最も反応率が高い文章です</p>

        {/* 本文 */}
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">
          {mainText}
        </p>

        {/* ボタン群 */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* ── クリック即送信 or テキストセット ── */}
          <button
            onClick={() => handleSendDirect(mainText)}
            disabled={sendStatus === "sending"}
            className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg transition-all ${directBtnCls}`}
          >
            {sendStatus === "sending" && (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                保存中…
              </>
            )}
            {sendStatus === "sent" && (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                送信しました
              </>
            )}
            {sendStatus === "error" && (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                失敗 — 再試行
              </>
            )}
            {sendStatus === "idle" && (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {onSendDirect ? "この内容で送信する（おすすめ）" : "送信文にセット"}
              </>
            )}
          </button>

          {onAppend && (
            <button
              onClick={() => handleAppend(mainText, mainIndex)}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                appendedIndex === mainIndex
                  ? "bg-sky-100 text-sky-700"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-sky-300 hover:text-sky-600"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {appendedIndex === mainIndex ? "✓ 追記済" : "追記"}
            </button>
          )}

          <button
            onClick={() => handleCopy(mainText, mainIndex)}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              copiedIndex === mainIndex
                ? "bg-emerald-100 text-emerald-700"
                : "bg-white border border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600"
            }`}
          >
            {copiedIndex === mainIndex ? (
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

        {/* エラーメッセージ */}
        {sendStatus === "error" && sendError && (
          <p className="mt-2 text-xs text-red-600">{sendError}</p>
        )}
      </div>

      {/* ── サブ候補（小さく・控えめ） ───────────────────── */}
      {subCandidates.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-0.5">
            他の案
          </p>
          {subCandidates.map(({ text, i }) => {
            const isSales = salesStartIndex !== undefined && i >= salesStartIndex;
            const label   = extractLabel(text, i);
            return (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-start gap-3">
                  {/* 本文（左側） */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold text-gray-400">{label}</span>
                      {isSales && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          提案文
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {text}
                    </p>
                  </div>

                  {/* ボタン群（右側） */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {onSelect && (
                      <button
                        onClick={() => handleSelect(text, i)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-all whitespace-nowrap"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        この案に切り替え
                      </button>
                    )}
                    <div className="flex gap-1">
                      {onAppend && (
                        <button
                          onClick={() => handleAppend(text, i)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                            appendedIndex === i
                              ? "bg-sky-100 text-sky-700"
                              : "bg-white border border-gray-200 text-gray-400 hover:text-sky-600"
                          }`}
                        >
                          {appendedIndex === i ? "✓ 追記済" : "追記"}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(text, i)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                          copiedIndex === i
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-white border border-gray-200 text-gray-400 hover:text-emerald-600"
                        }`}
                      >
                        {copiedIndex === i ? "✓ コピー済" : "コピー"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
