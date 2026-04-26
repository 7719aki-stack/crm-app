"use client";

import { useState, useEffect } from "react";
import { getTemplateStats, type TemplateStats } from "@/lib/sendResultTracker";

type SortMode = "revenue" | "cvr";

export function WinTemplateRanking() {
  const [stats,    setStats]    = useState<TemplateStats[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("revenue");
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => {
    setMounted(true);
    setStats(getTemplateStats("revenue").slice(0, 5));
  }, []);

  // ソートモード切り替え
  useEffect(() => {
    if (!mounted) return;
    setStats(getTemplateStats(sortMode).slice(0, 5));
  }, [sortMode, mounted]);

  if (!mounted) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-800">勝ちテンプレランキング</h3>
        {stats.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5">
            {stats.length}
          </span>
        )}
        {/* ソート切り替え */}
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setSortMode("revenue")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all ${
              sortMode === "revenue"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            売上順
          </button>
          <button
            onClick={() => setSortMode("cvr")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all ${
              sortMode === "cvr"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            成約率順
          </button>
        </div>
      </div>

      {/* 空状態 */}
      {stats.length === 0 ? (
        <div className="px-5 py-10 text-center space-y-1">
          <p className="text-sm text-gray-400">まだデータがありません</p>
          <p className="text-xs text-gray-300">LINE送信後に「結果を記録」すると集計されます</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {stats.map((s, i) => (
            <div key={s.templateId} className="flex items-center gap-3 px-5 py-3.5">
              {/* 順位バッジ */}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 ${
                i === 0 ? "bg-amber-400 text-white" :
                i === 1 ? "bg-gray-400 text-white" :
                i === 2 ? "bg-orange-300 text-white" :
                "bg-gray-100 text-gray-400"
              }`}>
                {i + 1}
              </span>

              {/* テンプレ名 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 leading-none truncate">
                  {s.templateLabel}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {s.totalSent}回送信 / {s.conversions}件成約
                </p>
              </div>

              {/* 指標 */}
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {s.revenue > 0 && (
                  <span className="text-sm font-bold text-emerald-700">
                    ¥{s.revenue.toLocaleString()}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.conversionRate >= 0.5
                    ? "bg-emerald-50 text-emerald-700"
                    : s.conversionRate >= 0.2
                    ? "bg-amber-50 text-amber-700"
                    : "bg-gray-50 text-gray-500"
                }`}>
                  CVR {(s.conversionRate * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-2 border-t border-gray-50">
        <p className="text-[10px] text-gray-300">
          LINE送信後の「結果を記録」からデータが蓄積されます（このデバイスのみ）
        </p>
      </div>
    </div>
  );
}
