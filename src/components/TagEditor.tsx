"use client";

import { useEffect, useState } from "react";
import { loadTagMaster, type TagGroup } from "@/lib/tagMaster";

interface TagEditorProps {
  /** 現在設定中のタグラベル一覧 */
  value:    string[];
  /** タグ変更時のコールバック */
  onChange: (tags: string[]) => void;
  /** 未保存の変更があるか */
  unsaved?: boolean;
}

// タグ文字列からハッシュベースで色クラスを決定
const ACTIVE_CLASSES = [
  "bg-violet-500 text-white",
  "bg-blue-500 text-white",
  "bg-cyan-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-pink-500 text-white",
  "bg-indigo-500 text-white",
] as const;

function tagActiveClass(label: string): string {
  const hash = [...label].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ACTIVE_CLASSES[hash % ACTIVE_CLASSES.length];
}

export function TagEditor({ value, onChange, unsaved }: TagEditorProps) {
  const [groups, setGroups] = useState<TagGroup[]>([]);

  useEffect(() => {
    setGroups(loadTagMaster());
  }, []);

  function toggle(label: string) {
    onChange(
      value.includes(label)
        ? value.filter((t) => t !== label)
        : [...value, label],
    );
  }

  return (
    <div>
      {/* ── アクティブタグ（現在選択中）─────────────── */}
      <div className="min-h-[36px] flex flex-wrap gap-1.5 mb-4">
        {value.length === 0 ? (
          <span className="text-xs text-gray-300 self-center">タグが設定されていません</span>
        ) : (
          value.map((label) => (
            <button
              key={label}
              onClick={() => toggle(label)}
              title="クリックで解除"
              className={`
                inline-flex items-center gap-1 text-xs font-semibold
                px-2.5 py-1 rounded-full transition-all
                shadow-sm hover:opacity-80 active:scale-95
                ${tagActiveClass(label)}
              `}
            >
              {label}
              <span className="opacity-60 text-[11px] ml-0.5">×</span>
            </button>
          ))
        )}
      </div>

      {/* ── タグパレット（グループ別）──────────────── */}
      <div className="space-y-3 pt-3 border-t border-gray-100">
        {groups.map(({ id, label, tags }) => (
          <div key={id}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              {label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isActive = value.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggle(tag)}
                    title={isActive ? "クリックで解除" : "クリックで追加"}
                    className={`
                      inline-flex items-center gap-1.5 text-xs font-medium
                      px-2.5 py-1 rounded-full transition-all
                      ${isActive
                        ? `${tagActiveClass(tag)} shadow-sm scale-105`
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                      }
                    `}
                  >
                    {tag}
                    {isActive && <span className="text-[10px] opacity-60">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 未保存インジケーター */}
      {unsaved && (
        <p className="text-[10px] text-amber-500 mt-3 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          変更あり（保存ボタンで確定）
        </p>
      )}
    </div>
  );
}
