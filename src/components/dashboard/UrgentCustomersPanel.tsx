"use client";

import { useState } from "react";
import Link from "next/link";

export interface UrgentCustomer {
  id:          number;
  name:        string;
  next_action: string | null;
}

interface Props {
  initialCustomers: UrgentCustomer[];
}

// 対応後の次回アクション日を計算（現状: 固定+3日）
function getNextActionDate(daysAhead = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function UrgentCustomersPanel({ initialCustomers }: Props) {
  const [customers, setCustomers] = useState<UrgentCustomer[]>(initialCustomers);
  // 対応済みにした直後のID（緑フラッシュ用）
  const [doneIds, setDoneIds]     = useState<Set<number>>(new Set());
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [errorId, setErrorId]     = useState<number | null>(null);

  async function markDone(id: number) {
    setLoadingId(id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ next_action: getNextActionDate() }),
      });
      if (!res.ok) throw new Error("更新に失敗しました");

      // 緑フラッシュ → 500ms後にリストから削除
      setDoneIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        setDoneIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }, 600);
    } catch {
      setErrorId(id);
    } finally {
      setLoadingId(null);
    }
  }

  const today = getToday();

  if (customers.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-gray-300">対応が必要な顧客はいません</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {customers.map((c) => {
        const isDone    = doneIds.has(c.id);
        const isLoading = loadingId === c.id;
        const isError   = errorId   === c.id;
        const isOverdue = c.next_action !== null && c.next_action <= today;
        const isNull    = c.next_action === null;

        // 行の背景色
        const rowBg = isDone
          ? "bg-emerald-50/70"
          : "hover:bg-gray-50/60";

        return (
          <div
            key={c.id}
            className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${rowBg}`}
          >
            {/* アバター */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              isDone    ? "bg-emerald-100"
              : isOverdue ? "bg-red-100"
              : "bg-gray-100"
            }`}>
              <span className={`text-xs font-bold ${
                isDone    ? "text-emerald-600"
                : isOverdue ? "text-red-600"
                : "text-gray-500"
              }`}>
                {(c.name || "?")[0]}
              </span>
            </div>

            {/* 顧客名 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
            </div>

            {/* next_action 日付バッジ */}
            <div className="flex-shrink-0">
              {isDone ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium">
                  ✓ 対応済み
                </span>
              ) : isNull ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                  未設定
                </span>
              ) : isOverdue ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                  ⚠ {c.next_action}
                </span>
              ) : (
                <span className="text-xs text-gray-500">{c.next_action}</span>
              )}
            </div>

            {/* エラー */}
            {isError && (
              <span className="text-[11px] text-red-500 flex-shrink-0">失敗</span>
            )}

            {/* ボタン群 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 対応する → 詳細ページへ */}
              <Link
                href={`/customers/${c.id}`}
                className="text-xs font-medium text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors whitespace-nowrap"
              >
                対応する
              </Link>

              {/* 今日対応済みにする */}
              {!isDone && (
                <button
                  onClick={() => markDone(c.id)}
                  disabled={isLoading}
                  className="text-xs font-medium text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isLoading ? "更新中…" : "今日対応済み"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
