"use client";

import { useEffect, useState, useCallback } from "react";
import type { ScenarioSchedule, ScenarioScheduleStatus } from "@/lib/educationScenario";

// ─── ステータス表示設定 ──────────────────────────────────

const STATUS_LABEL: Record<ScenarioScheduleStatus, string> = {
  pending:   "予定",
  sent:      "送信済",
  cancelled: "キャンセル",
};

const STATUS_STYLE: Record<ScenarioScheduleStatus, string> = {
  pending:   "bg-blue-50 text-blue-700 border border-blue-100",
  sent:      "bg-emerald-50 text-emerald-700 border border-emerald-100",
  cancelled: "bg-red-50 text-red-500 border border-red-100",
};

// ─── 日時フォーマット ────────────────────────────────────

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);

  const dateStr = d.toLocaleString("ja-JP", {
    month:  "numeric",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });

  if (diffMin < 0) return `${dateStr}（期限超過）`;
  if (diffMin < 60) return `${dateStr}（約${diffMin}分後）`;
  if (diffMin < 1440) return `${dateStr}（約${Math.round(diffMin / 60)}時間後）`;
  return `${dateStr}（約${Math.round(diffMin / 1440)}日後）`;
}

function truncate(text: string, maxLen = 40): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

// ─── メインコンポーネント ────────────────────────────────

interface Props {
  customerId: number;
}

export function EducationScenarioPanel({ customerId }: Props) {
  const [schedules, setSchedules] = useState<ScenarioSchedule[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [starting,  setStarting]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/scenario-schedules`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json() as ScenarioSchedule[];
      setSchedules(data);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function startScenario() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/scenario-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await load();
    } catch {
      setError("スケジュール生成に失敗しました");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-300 animate-pulse">読み込み中…</p>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-400">{error}</p>
        <button
          onClick={load}
          className="text-[11px] text-gray-400 hover:text-gray-600 underline"
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-300">教育シナリオ未開始</p>
        <button
          onClick={startScenario}
          disabled={starting}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {starting ? "生成中…" : "シナリオを開始"}
        </button>
      </div>
    );
  }

  const pendingCount = schedules.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-2">
      {pendingCount > 0 && (
        <p className="text-[11px] text-blue-600 font-medium mb-3">
          送信予定 {pendingCount} 件
        </p>
      )}

      {schedules.map((s) => {
        const status = s.status as ScenarioScheduleStatus;
        return (
          <div
            key={s.id}
            className={`rounded-lg border border-gray-100 p-3 transition-opacity ${
              status !== "pending" ? "opacity-50" : ""
            }`}
          >
            {/* ヘッダー行 */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                教育シナリオ
              </span>
              <span className="text-[10px] text-gray-400">
                Step {s.step_no}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </div>

            {/* 予定日時 */}
            <p className="text-[11px] text-gray-400 mb-1.5">
              {status === "sent" && s.sent_at
                ? `送信済: ${new Date(s.sent_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                : formatScheduled(s.scheduled_at)}
            </p>

            {/* メッセージ要約 */}
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {truncate(s.message_body)}
            </p>
          </div>
        );
      })}

      {/* 全て完了後に再開始できるようにする */}
      {schedules.every((s) => s.status !== "pending") && (
        <button
          onClick={startScenario}
          disabled={starting}
          className="mt-2 text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          {starting ? "生成中…" : "シナリオを再開始"}
        </button>
      )}
    </div>
  );
}
