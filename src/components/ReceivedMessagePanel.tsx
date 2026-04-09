"use client";

import { useState } from "react";
import { detectKeywords, applyTagChanges, type MatchResult } from "@/lib/keywordRules";
import { triggerScenariosForTags } from "@/lib/scenarios";
import type { ActionEntry } from "@/app/customers/dummyData";

interface Props {
  customerId: number;
  tags:       string[];
  /** タグ更新後の新しいタグ配列を通知 */
  onTagsChange:   (newTags: string[]) => void;
  /** アクション追加後のエントリを通知 */
  onActionAdded:    (entry: ActionEntry) => void;
  /** シナリオキューが追加されたときに通知（親で再読み込みをトリガー） */
  onScenarioQueued?: () => void;
}

export function ReceivedMessagePanel({
  customerId,
  tags,
  onTagsChange,
  onActionAdded,
  onScenarioQueued,
}: Props) {
  const [messageText,      setMessageText]      = useState("");
  const [result,           setResult]           = useState<MatchResult | null>(null);
  const [scenarioStarted,  setScenarioStarted]  = useState(false);
  const [copied,           setCopied]           = useState(false);
  const [processing,       setProcessing]       = useState(false);

  async function handleProcess() {
    if (!messageText.trim()) return;
    setProcessing(true);

    const matched = detectKeywords(messageText, tags);
    const newTags = applyTagChanges(tags, matched);

    const today = new Date().toISOString().slice(0, 10);

    const { getCustomerRepository } = await import("@/lib/repository");
    const repo = getCustomerRepository();

    // タグを保存 & シナリオトリガー
    if (matched.addedTags.length > 0 || matched.removedTags.length > 0) {
      repo.update(customerId, { tags: newTags });
      onTagsChange(newTags);

      // 新しく付与されたタグに対応するシナリオを開始
      if (matched.addedTags.length > 0) {
        const started = triggerScenariosForTags(customerId, matched.addedTags);
        if (started.length > 0) {
          setScenarioStarted(true);
          onScenarioQueued?.();
        }
      }
    }

    // アクション履歴に「受信」を記録
    const actionNote =
      matched.rule
        ? `受信：「${messageText}」\n判定：${matched.rule.label} / タグ追加：${matched.addedTags.join("、") || "なし"}`
        : `受信：「${messageText}」\n判定：キーワードなし`;

    const entry = repo.addAction(customerId, {
      date:        today,
      type:        "受信",
      note:        actionNote,
      replyIntent: matched.rule?.replyIntent,
    });
    onActionAdded(entry);

    setResult(matched);
    setProcessing(false);
  }

  function handleClear() {
    setMessageText("");
    setResult(null);
    setCopied(false);
    setScenarioStarted(false);
  }

  async function handleCopy() {
    if (!result?.replyCandidate) return;
    await navigator.clipboard.writeText(result.replyCandidate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      {/* ── 入力エリア ─────────────────────────────── */}
      <textarea
        value={messageText}
        onChange={(e) => { setMessageText(e.target.value); setResult(null); }}
        placeholder="顧客から受信したメッセージを入力..."
        rows={3}
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={handleProcess}
          disabled={!messageText.trim() || processing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {processing ? "処理中…" : "受信処理"}
        </button>
        {(messageText || result) && (
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      {/* ── 判定結果 ────────────────────────────────── */}
      {result && (
        <div className="mt-2 rounded-lg border border-gray-100 overflow-hidden">
          {/* 判定ヘッダー */}
          <div className={`px-4 py-2.5 flex items-center gap-2 ${
            result.rule ? "bg-emerald-50 border-b border-emerald-100" : "bg-gray-50 border-b border-gray-100"
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${result.rule ? "bg-emerald-500" : "bg-gray-400"}`} />
            <span className={`text-xs font-semibold ${result.rule ? "text-emerald-700" : "text-gray-500"}`}>
              {result.rule ? `キーワード一致：${result.rule.label}` : "キーワード: 一致なし"}
            </span>
          </div>

          <div className="px-4 py-3 space-y-3 bg-white">
            {/* 追加されたタグ */}
            {result.addedTags.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  自動付与タグ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.addedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500 text-white"
                    >
                      <span className="text-[11px]">+</span>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.addedTags.length === 0 && result.rule && (
              <p className="text-xs text-gray-400">タグはすでに設定済みです</p>
            )}

            {/* 返信候補 */}
            {result.replyCandidate && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    返信候補
                  </p>
                  <button
                    onClick={handleCopy}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      copied
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-white text-gray-500 border-gray-200 hover:border-brand-300 hover:text-brand-600"
                    }`}
                  >
                    {copied ? "コピー済み ✓" : "コピー"}
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg px-3.5 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                  {result.replyCandidate}
                </div>
              </div>
            )}

            {/* シナリオ開始通知 */}
            {scenarioStarted && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                シナリオ予定を作成しました。下の「シナリオ予定」で確認できます。
              </div>
            )}

            {/* 一致なしの場合 */}
            {!result.rule && (
              <p className="text-xs text-gray-400">
                自動対応なし。手動で返信内容を確認してください。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
