"use client";

import { useState, useRef, useEffect } from "react";
import {
  STATUSES, STATUS_GROUPS, getStatus, getStatusesByGroup,
  type StatusId,
} from "@/lib/statuses";

interface StatusPickerProps {
  value:    StatusId;
  onChange: (id: StatusId) => void;
  unsaved?: boolean;
}

export function StatusPicker({ value, onChange, unsaved }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getStatus(value);

  // クリック外で閉じる
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(id: StatusId) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* トリガーボタン：現在のステータスをバッジ表示 */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
          border text-xs font-semibold transition-all
          hover:shadow-sm active:scale-[0.98]
          ${current?.badgeClass ?? "bg-gray-100 text-gray-500 border-gray-200"}
          ${open ? "ring-2 ring-brand-400 ring-offset-1" : ""}
        `}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${current?.dotClass}`} />
        {current?.label ?? value}
        <svg
          className={`w-3 h-3 opacity-50 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ドロップダウンパネル */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-xl shadow-gray-200/80 overflow-hidden">
          <div className="p-1.5 max-h-80 overflow-y-auto">
            {STATUS_GROUPS.map(({ group, label }) => {
              const groupStatuses = getStatusesByGroup(group);
              return (
                <div key={group} className="mb-1 last:mb-0">
                  {/* グループヘッダー */}
                  <div className="px-2.5 pt-2 pb-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {label}
                    </p>
                  </div>
                  {/* ステータス一覧 */}
                  {groupStatuses.map((s) => {
                    const isSelected = s.id === value;
                    return (
                      <button
                        key={s.id}
                        onClick={() => select(s.id)}
                        className={`
                          w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
                          text-xs font-medium transition-all
                          ${isSelected
                            ? `${s.badgeClass} font-semibold`
                            : "text-gray-600 hover:bg-gray-50"
                          }
                        `}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dotClass}`} />
                        <span className="flex-1">{s.label}</span>
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 未保存インジケーター */}
      {unsaved && (
        <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          変更あり（次フェーズで保存機能を実装）
        </p>
      )}
    </div>
  );
}

// ─── バッジのみ表示（一覧画面用）──────────────────────
export function StatusBadgeNew({ status }: { status: StatusId }) {
  const def = getStatus(status);
  if (!def) return <span className="text-xs text-gray-400">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${def.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${def.dotClass}`} />
      {def.label}
    </span>
  );
}
