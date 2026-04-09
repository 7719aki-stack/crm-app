"use client";

import { useEffect, useState } from "react";
import {
  loadTagMaster,
  saveTagMaster,
  DEFAULT_TAG_MASTER,
  type TagGroup,
} from "@/lib/tagMaster";

// ─── タグマスタ管理パネル ──────────────────────────────
function TagMasterPanel() {
  const [groups,    setGroups]    = useState<TagGroup[]>([]);
  const [saved,     setSaved]     = useState(false);
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setGroups(loadTagMaster());
  }, []);

  function handleSave() {
    saveTagMaster(groups);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    if (!confirm("タグマスタを初期値にリセットしますか？")) return;
    setGroups(DEFAULT_TAG_MASTER);
    saveTagMaster(DEFAULT_TAG_MASTER);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function removeTag(groupId: string, tag: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, tags: g.tags.filter((t) => t !== tag) } : g,
      ),
    );
  }

  function addTag(groupId: string) {
    const val = (newTagInputs[groupId] ?? "").trim();
    if (!val) return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        if (g.tags.includes(val)) return g; // 重複不可
        return { ...g, tags: [...g.tags, val] };
      }),
    );
    setNewTagInputs((prev) => ({ ...prev, [groupId]: "" }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">タグマスタ管理</h3>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 font-medium">保存しました</span>
          )}
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            初期値に戻す
          </button>
          <button
            onClick={handleSave}
            className="text-xs bg-brand-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        <p className="text-xs text-gray-400">
          各グループのタグを管理します。タグを追加・削除して「保存」を押してください。
        </p>

        {groups.map((group) => (
          <div key={group.id}>
            <p className="text-xs font-bold text-gray-600 mb-2">{group.label}</p>

            {/* タグ一覧 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {group.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(group.id, tag)}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-0.5 text-[11px] leading-none"
                    title="削除"
                  >
                    ×
                  </button>
                </span>
              ))}
              {group.tags.length === 0 && (
                <span className="text-xs text-gray-300">タグなし</span>
              )}
            </div>

            {/* タグ追加 */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="新しいタグを入力..."
                value={newTagInputs[group.id] ?? ""}
                onChange={(e) =>
                  setNewTagInputs((prev) => ({ ...prev, [group.id]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && addTag(group.id)}
                className="flex-1 max-w-xs px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
              <button
                onClick={() => addTag(group.id)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                追加
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── その他の予定設定項目 ─────────────────────────────
const OTHER_PLANNED = [
  { icon: "🔗", label: "LINE連携",        note: "LINE Official Account と接続" },
  { icon: "👤", label: "プロフィール設定", note: "表示名・アイコンの変更" },
  { icon: "💴", label: "料金プリセット",   note: "鑑定メニューと料金の登録" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* タグマスタ管理（実装済み） */}
      <TagMasterPanel />

      {/* その他（準備中） */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">その他の設定（準備中）</h3>
        </div>
        <ul className="divide-y divide-gray-50">
          {OTHER_PLANNED.map((item) => (
            <li key={item.label} className="flex items-center gap-4 px-5 py-4 opacity-60">
              <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.note}</p>
              </div>
              <span className="ml-auto text-[10px] text-gray-300 flex-shrink-0">準備中</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
