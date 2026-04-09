"use client";

import { useEffect, useState } from "react";
import {
  getCustomerScenarioQueue,
  updateScenarioQueueStatus,
  SCENARIO_MASTER,
  type ScenarioQueueItem,
  type ScenarioStatus,
} from "@/lib/scenarios";

// ─── ステータス表示設定 ───────────────────────────────

const STATUS_LABEL: Record<ScenarioStatus, string> = {
  pending:   "予定",
  sent:      "送信済",
  skipped:   "スキップ",
  cancelled: "キャンセル",
};

const STATUS_STYLE: Record<ScenarioStatus, string> = {
  pending:   "bg-blue-50 text-blue-700 border border-blue-100",
  sent:      "bg-emerald-50 text-emerald-700 border border-emerald-100",
  skipped:   "bg-gray-100 text-gray-500 border border-gray-200",
  cancelled: "bg-red-50 text-red-500 border border-red-100",
};

// ─── 日時フォーマット ─────────────────────────────────

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);

  const dateStr = d.toLocaleString("ja-JP", {
    month: "numeric", day: "numeric",
    hour:  "2-digit", minute: "2-digit",
  });

  if (diffMin > 0 && diffMin < 60) return `${dateStr}（約${diffMin}分後）`;
  if (diffMin >= 60 && diffMin < 1440) return `${dateStr}（約${Math.round(diffMin / 60)}時間後）`;
  if (diffMin >= 1440) return `${dateStr}（約${Math.round(diffMin / 1440)}日後）`;
  return dateStr;
}

// ─── メインコンポーネント ─────────────────────────────

interface Props {
  customerId: number;
  /** 親から再読み込みをトリガーするためのカウンタ */
  refreshKey?: number;
}

export function ScenarioQueuePanel({ customerId, refreshKey }: Props) {
  const [items, setItems] = useState<ScenarioQueueItem[]>([]);

  function load() {
    setItems(getCustomerScenarioQueue(customerId));
  }

  useEffect(() => { load(); }, [customerId, refreshKey]);

  function changeStatus(id: string, status: ScenarioStatus) {
    updateScenarioQueueStatus(id, status);
    load();
  }

  function getScenarioLabel(key: string): string {
    return SCENARIO_MASTER.find((s) => s.key === key)?.label ?? key;
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-300">シナリオ予定はありません</p>
    );
  }

  // pending件数
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-2">
      {pendingCount > 0 && (
        <p className="text-[11px] text-blue-600 font-medium mb-3">
          送信予定 {pendingCount} 件
        </p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg border border-gray-100 p-3 transition-opacity ${
            item.status !== "pending" ? "opacity-50" : ""
          }`}
        >
          {/* ヘッダー行 */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {getScenarioLabel(item.scenarioKey)}
            </span>
            <span className="text-[10px] text-gray-400">
              Step {item.stepIndex + 1}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
          </div>

          {/* 予定日時 */}
          <p className="text-[11px] text-gray-400 mb-1.5">
            {formatScheduled(item.scheduledAt)}
          </p>

          {/* メッセージ本文 */}
          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            {item.messageText}
          </p>

          {/* 操作ボタン（pending のみ表示） */}
          {item.status === "pending" && (
            <div className="flex gap-1.5 mt-2.5">
              <button
                onClick={() => changeStatus(item.id, "sent")}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
              >
                送信済みにする
              </button>
              <button
                onClick={() => changeStatus(item.id, "skipped")}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
              >
                スキップ
              </button>
              <button
                onClick={() => changeStatus(item.id, "cancelled")}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
