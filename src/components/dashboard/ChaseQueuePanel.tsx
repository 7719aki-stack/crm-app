"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ChaseQueueItem } from "@/lib/dashboard";
import { SCORE_LABEL_STYLE } from "@/lib/customerScore";

// localStorage キー: 日付ごとに分離 → 翌日自動リセット
const DONE_KEY_PREFIX = "crm_chase_done_";

function getTodayKey(): string {
  return DONE_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

function loadDoneIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(getTodayKey());
    return new Set(JSON.parse(raw ?? "[]") as number[]);
  } catch {
    return new Set();
  }
}

function saveDoneIds(ids: Set<number>): void {
  localStorage.setItem(getTodayKey(), JSON.stringify([...ids]));
}

// 経過時間の色クラス
function elapsedCls(hours: number): string {
  if (hours >= 72) return "text-red-600";
  if (hours >= 48) return "text-orange-500";
  return "text-amber-500";
}

// 理由タグの色マッピング
const REASON_CLS: Record<string, string> = {
  "高スコア":         "bg-violet-50 text-violet-700 border-violet-100",
  "次アクション未設定": "bg-red-50 text-red-600 border-red-100",
  "LINE未送信":       "bg-sky-50 text-sky-600 border-sky-100",
};
function getReasonCls(reason: string): string {
  if (reason.endsWith("未返信")) return "bg-amber-50 text-amber-700 border-amber-200";
  return REASON_CLS[reason] ?? "bg-gray-50 text-gray-500 border-gray-200";
}

type Props = {
  items: ChaseQueueItem[];
};

export function ChaseQueuePanel({ items }: Props) {
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDoneIds(loadDoneIds());
    setMounted(true);
  }, []);

  const handleDone = (id: number) => {
    const next = new Set(doneIds);
    next.add(id);
    setDoneIds(next);
    saveDoneIds(next);
  };

  const visible   = mounted ? items.filter((item) => !doneIds.has(item.id)) : items;
  const doneCount = items.length - visible.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-800">追客キュー</h3>
        {visible.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold px-1.5">
            {visible.length}
          </span>
        )}
        <p className="text-xs text-gray-400 ml-auto hidden sm:block">
          優先度順 — 対応済みにするとキューから消えます（翌日リセット）
        </p>
        {doneCount > 0 && (
          <span className="text-[11px] text-gray-400 ml-2">
            {doneCount}件対応済み
          </span>
        )}
      </div>

      {/* 空状態 */}
      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-gray-500 mb-1">今日のキューは完了です</p>
          <p className="text-xs text-gray-300">明日になるとまた表示されます</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/40 transition-colors"
            >
              {/* 名前 + LINE状態 */}
              <div className="w-28 flex-shrink-0 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-none truncate">
                  {item.display_name}
                </p>
                <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                  LINE接続済
                </span>
              </div>

              {/* スコア */}
              <div className="flex flex-col items-center gap-0.5 w-12 flex-shrink-0">
                <span className="text-xl font-extrabold text-gray-800 leading-none">
                  {item.score}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${SCORE_LABEL_STYLE[item.scoreLabel]}`}>
                  {item.scoreLabel}
                </span>
              </div>

              {/* 理由タグ + 次アクション */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-1">
                  {item.queueReasons.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${getReasonCls(r)}`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
                  {item.next_action ? (
                    <span>次回: {item.next_action}</span>
                  ) : (
                    <span className="text-red-400">次アクション未設定</span>
                  )}
                  {item.hoursElapsed !== null && item.hoursElapsed >= 24 && (
                    <span className={`font-semibold ${elapsedCls(item.hoursElapsed)}`}>
                      {item.hoursElapsed}h経過
                    </span>
                  )}
                </div>
                {/* スコア理由（小さく） */}
                <div className="flex flex-wrap gap-x-2 mt-0.5">
                  {item.scoreReasons.slice(0, 2).map((r) => (
                    <span key={r} className="inline-flex items-center gap-0.5 text-[10px] text-gray-300">
                      <span className="w-1 h-1 rounded-full bg-brand-200 flex-shrink-0" />
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* ボタン群 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleDone(item.id)}
                  className="text-xs font-medium text-gray-500 border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  対応済み
                </button>
                <Link
                  href={`/customers/${item.id}`}
                  className="text-xs font-semibold text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
                >
                  詳細へ
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
