"use client";

import { useEffect, useState } from "react";
import {
  loadTagMaster,
  saveTagMaster,
  DEFAULT_TAG_MASTER,
  type TagGroup,
} from "@/lib/tagMaster";
import {
  loadPricePresets,
  savePricePresets,
  OFFER_PRODUCTS,
  type OfferProduct,
} from "@/lib/products";

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

// ─── 料金プリセット管理パネル ─────────────────────────
const EMPTY_PRESET: OfferProduct = {
  id: "",
  name: "",
  price: 0,
  type: "upsell",
  offerType: "quick",
  recommendedTags: [],
  paymentUrl: "",
};

function PricePresetPanel() {
  const [presets, setPresets] = useState<OfferProduct[]>([]);
  const [saved,   setSaved]   = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // id being edited
  const [draft,   setDraft]   = useState<OfferProduct>(EMPTY_PRESET);
  const [adding,  setAdding]  = useState(false);
  const [newDraft, setNewDraft] = useState<OfferProduct>(EMPTY_PRESET);

  useEffect(() => {
    setPresets(loadPricePresets());
  }, []);

  function handleSave() {
    savePricePresets(presets);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    if (!confirm("料金プリセットを初期値にリセットしますか？")) return;
    setPresets(OFFER_PRODUCTS);
    savePricePresets(OFFER_PRODUCTS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function startEdit(p: OfferProduct) {
    setEditing(p.id);
    setDraft({ ...p });
  }

  function cancelEdit() {
    setEditing(null);
  }

  function commitEdit() {
    if (!draft.name.trim()) return;
    setPresets((prev) => prev.map((p) => (p.id === editing ? { ...draft } : p)));
    setEditing(null);
  }

  function removePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function startAdd() {
    setNewDraft({ ...EMPTY_PRESET, id: `preset_${Date.now()}` });
    setAdding(true);
  }

  function cancelAdd() {
    setAdding(false);
  }

  function commitAdd() {
    if (!newDraft.name.trim()) return;
    setPresets((prev) => [...prev, { ...newDraft }]);
    setAdding(false);
  }

  const TYPE_OPTIONS: { value: OfferProduct["type"]; label: string }[] = [
    { value: "main",   label: "メイン（常時表示）" },
    { value: "upsell", label: "アップセル（タグ一致時）" },
  ];

  function PresetForm({
    value,
    onChange,
    onCommit,
    onCancel,
  }: {
    value: OfferProduct;
    onChange: (v: OfferProduct) => void;
    onCommit: () => void;
    onCancel: () => void;
  }) {
    return (
      <div className="space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">商品名</label>
            <input
              type="text"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="商品名を入力"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">金額（円）</label>
            <input
              type="number"
              value={value.price}
              onChange={(e) => onChange({ ...value, price: parseInt(e.target.value, 10) || 0 })}
              placeholder="0"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">決済URL（Stores.jpなど）</label>
          <input
            type="url"
            value={value.paymentUrl}
            onChange={(e) => onChange({ ...value, paymentUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">種別</label>
            <select
              value={value.type}
              onChange={(e) =>
                onChange({ ...value, type: e.target.value as OfferProduct["type"] })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">推奨タグ（カンマ区切り）</label>
            <input
              type="text"
              value={(value.recommendedTags ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  ...value,
                  recommendedTags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="例: 復縁, 片思い・進展"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onCommit}
            disabled={!value.name.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40"
          >
            確定
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">料金プリセット</h3>
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

      <div className="p-5 space-y-3">
        <p className="text-xs text-gray-400">
          鑑定メニューと決済URLを管理します。おすすめ商品の表示にも使われます。
        </p>

        {/* 商品一覧 */}
        <div className="space-y-2">
          {presets.map((p) => (
            <div key={p.id}>
              {editing === p.id ? (
                <PresetForm
                  value={draft}
                  onChange={setDraft}
                  onCommit={commitEdit}
                  onCancel={cancelEdit}
                />
              ) : (
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        p.type === "main"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {p.type === "main" ? "メイン" : "アップセル"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-600">¥{p.price.toLocaleString()}</span>
                      {p.paymentUrl ? (
                        <a
                          href={p.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-brand-600 hover:underline truncate max-w-[200px]"
                        >
                          {p.paymentUrl}
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-300">決済URL未設定</span>
                      )}
                    </div>
                    {(p.recommendedTags ?? []).length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        推奨タグ: {p.recommendedTags!.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => removePreset(p.id)}
                      className="text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 追加フォーム */}
        {adding ? (
          <PresetForm
            value={newDraft}
            onChange={setNewDraft}
            onCommit={commitAdd}
            onCancel={cancelAdd}
          />
        ) : (
          <button
            onClick={startAdd}
            className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
          >
            + 商品を追加
          </button>
        )}
      </div>
    </div>
  );
}

// ─── バックアップパネル ───────────────────────────────
function BackupPanel() {
  const [status,  setStatus]  = useState<"idle" | "running" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sizeKB,  setSizeKB]  = useState<number | null>(null);
  const [history, setHistory] = useState<{ filename: string; sizeKB: number; createdAt: string }[]>([]);

  async function handleBackup() {
    setStatus("running");
    setMessage(null);
    try {
      const res  = await fetch("/api/backup");
      const json = await res.json() as { ok?: boolean; filename?: string; sizeKB?: number; createdAt?: string; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "エラーが発生しました");
      setSizeKB(json.sizeKB ?? null);
      setMessage(`${json.filename} を保存しました`);
      setStatus("ok");
      if (json.filename && json.sizeKB != null && json.createdAt) {
        setHistory((prev) => [
          { filename: json.filename!, sizeKB: json.sizeKB!, createdAt: json.createdAt! },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "バックアップに失敗しました");
      setStatus("error");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">データバックアップ</h3>
          <p className="text-xs text-gray-400 mt-0.5">SQLiteデータベースを data/backup/ フォルダにコピーします</p>
        </div>
        <button
          onClick={handleBackup}
          disabled={status === "running"}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {status === "running" ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              実行中…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              バックアップ作成
            </>
          )}
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* 結果メッセージ */}
        {message && (
          <div className={`flex items-start gap-2 text-xs px-3.5 py-3 rounded-lg border ${
            status === "ok"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-red-50 text-red-600 border-red-100"
          }`}>
            <span className="text-base leading-none flex-shrink-0">{status === "ok" ? "✓" : "✕"}</span>
            <div>
              <p className="font-medium">{message}</p>
              {status === "ok" && sizeKB != null && (
                <p className="text-[11px] mt-0.5 opacity-80">ファイルサイズ: {sizeKB.toLocaleString()} KB</p>
              )}
            </div>
          </div>
        )}

        {/* 実行履歴（このセッション内） */}
        {history.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 mb-2">今回の実行履歴</p>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.filename} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="font-medium text-gray-700 truncate mr-3">{h.filename}</span>
                  <span className="flex-shrink-0 text-gray-400">{h.sizeKB} KB</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          保存先: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">data/backup/love-crm-YYYYMMDD-HHMMSS.db</code>
        </p>
      </div>
    </div>
  );
}

// ─── その他の予定設定項目 ─────────────────────────────
const OTHER_PLANNED = [
  { icon: "🔗", label: "LINE連携",        note: "LINE Official Account と接続" },
  { icon: "👤", label: "プロフィール設定", note: "表示名・アイコンの変更" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* タグマスタ管理（実装済み） */}
      <TagMasterPanel />

      {/* 料金プリセット（実装済み） */}
      <PricePresetPanel />

      {/* バックアップ（実装済み） */}
      <BackupPanel />

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
