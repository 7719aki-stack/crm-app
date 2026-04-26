"use client";

import { useState, useMemo } from "react";
import type { DbMessage } from "@/app/api/customers/[id]/messages/route";

type Props = {
  customerId:    number;
  dbMessages:    DbMessage[];
  line_user_id?: string | null;
  onMessageSent?: () => void;
};

const FOLLOW_UP_HOURS = 24;

function formatHoursAgo(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (h >= 48) return `${Math.floor(h / 24)}日前`;
  if (h >= 1)  return `${h}時間${m > 0 ? `${m}分` : ""}前`;
  return `${m}分前`;
}

export function FollowUpPanel({ customerId, dbMessages, line_user_id, onMessageSent }: Props) {
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; message: string } | null>(null);

  const now = useMemo(() => new Date(), []);

  const lastSentMsg    = useMemo(
    () => [...dbMessages].reverse().find((m) => m.direction === "outbound"),
    [dbMessages],
  );
  const lastReceivedMsg = useMemo(
    () => [...dbMessages].reverse().find((m) => m.direction === "inbound"),
    [dbMessages],
  );

  const lastSentAt    = lastSentMsg    ? new Date(lastSentMsg.created_at)    : null;
  const lastReceivedAt = lastReceivedMsg ? new Date(lastReceivedMsg.created_at) : null;

  const hoursSinceSent = lastSentAt
    ? (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60)
    : null;

  // フォロー対象条件: 24h以上経過 + 最終送信後に受信なし
  const isFollowUpCandidate = useMemo(() => {
    if (!lastSentAt || hoursSinceSent == null) return false;
    if (hoursSinceSent < FOLLOW_UP_HOURS) return false;
    if (lastReceivedAt && lastReceivedAt > lastSentAt) return false;
    return true;
  }, [lastSentAt, hoursSinceSent, lastReceivedAt]);

  const hasLineId = !!line_user_id;

  const handleManualSend = async () => {
    if (!hasLineId) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/follow-up/process", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "フォロー送信に失敗しました" });
        return;
      }
      const r = data.results?.[0];
      if (r?.skipped) {
        setResult({ ok: false, message: `スキップ: ${r.reason ?? "条件未達"}` });
      } else if (r?.ok) {
        setResult({ ok: true, message: "フォローメッセージを送信しました" });
        onMessageSent?.();
      } else {
        setResult({ ok: false, message: r?.reason ?? "送信失敗" });
      }
    } catch {
      setResult({ ok: false, message: "通信エラーが発生しました" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">フォローアップ</h3>
        {isFollowUpCandidate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            フォロー対象
          </span>
        )}
      </div>

      {/* 送受信時間グリッド */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-gray-500 mb-0.5">最終送信</p>
          {lastSentAt ? (
            <p className="font-medium text-gray-800">
              {formatHoursAgo(lastSentAt, now)}
              {hoursSinceSent != null && hoursSinceSent >= FOLLOW_UP_HOURS && (
                <span className="ml-1 text-amber-600">({Math.floor(hoursSinceSent)}時間)</span>
              )}
            </p>
          ) : (
            <p className="text-gray-400">送信なし</p>
          )}
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-gray-500 mb-0.5">最終受信</p>
          {lastReceivedAt ? (
            <p className="font-medium text-gray-800">{formatHoursAgo(lastReceivedAt, now)}</p>
          ) : (
            <p className="text-gray-400">未返信</p>
          )}
        </div>
      </div>

      {/* 手動送信ボタン */}
      <button
        onClick={handleManualSend}
        disabled={sending || !hasLineId}
        className={[
          "w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isFollowUpCandidate
            ? "bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50",
        ].join(" ")}
      >
        {sending ? "送信中…" : "フォローを今すぐ送信"}
      </button>

      {!hasLineId && (
        <p className="text-xs text-red-500">LINE IDが未設定のため送信できません</p>
      )}

      {/* 結果表示 */}
      {result && (
        <p className={`text-xs font-medium ${result.ok ? "text-green-600" : "text-red-500"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
