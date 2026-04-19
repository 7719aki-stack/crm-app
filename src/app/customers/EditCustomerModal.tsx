"use client";

import { useState } from "react";
import type { CustomerDetail, Category, Temperature, CrisisLevel } from "./dummyData";

const CATEGORIES: Category[] = ["片思い", "復縁", "不倫", "婚活", "複雑系", "浮気確認"];
const TEMPERATURES: { value: Temperature; label: string; emoji: string }[] = [
  { value: "cold", label: "冷え気味", emoji: "❄️" },
  { value: "cool", label: "普通",     emoji: "🌤"  },
  { value: "warm", label: "温まり中", emoji: "☀️" },
  { value: "hot",  label: "熱い",     emoji: "🔥" },
];

export interface EditableFields {
  name:         string;
  display_name: string;
  category:     Category;
  crisis_level: CrisisLevel;
  temperature:  Temperature;
  next_action:  string | null;
}

interface Props {
  customer: CustomerDetail;
  onClose:  () => void;
  onSuccess: (updated: EditableFields) => void;
}

export function EditCustomerModal({ customer, onClose, onSuccess }: Props) {
  const [name,        setName]        = useState(customer.name);
  const [displayName, setDisplayName] = useState(customer.display_name ?? "");
  const [category,    setCategory]    = useState<Category>(customer.category);
  const [crisisLevel, setCrisisLevel] = useState<CrisisLevel>(customer.crisis_level);
  const [temperature, setTemperature] = useState<Temperature>(customer.temperature);
  const [nextAction,  setNextAction]  = useState(customer.next_action ?? "");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError("名前を入力してください"); return; }
    if (trimmedName.length < 2) { setError("名前は2文字以上で入力してください"); return; }
    if (!/[a-zA-Z0-9\u3040-\u9fff\uff00-\uffef]/.test(trimmedName)) {
      setError("記号のみの名前は登録できません（日本語・英数字を含めてください）");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:         trimmedName,
          display_name: displayName.trim() || null,
          category,
          crisis_level: crisisLevel,
          temperature,
          next_action:  nextAction || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "更新に失敗しました");
      }
      onSuccess({
        name:         trimmedName,
        display_name: displayName.trim() || trimmedName,
        category,
        crisis_level: crisisLevel,
        temperature,
        next_action:  nextAction || null,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">顧客情報を編集</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>
          )}

          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              名前 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
          </div>

          {/* 表示名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              表示名 <span className="text-gray-400 font-normal">（ニックネーム）</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="未入力の場合は名前を使用"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">カテゴリ</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === cat
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 危機度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              危機度{" "}
              <span className={`font-bold ${
                crisisLevel >= 5 ? "text-red-600"
                : crisisLevel >= 4 ? "text-orange-600"
                : crisisLevel >= 3 ? "text-amber-600"
                : crisisLevel >= 2 ? "text-yellow-600"
                : "text-gray-400"
              }`}>
                {["", "安定", "注意", "要注意", "危険", "緊急"][crisisLevel]}({crisisLevel})
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={crisisLevel}
              onChange={(e) => setCrisisLevel(Number(e.target.value) as CrisisLevel)}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              {[1,2,3,4,5].map((n) => <span key={n}>{n}</span>)}
            </div>
          </div>

          {/* 温度感 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">温度感</label>
            <div className="grid grid-cols-4 gap-2">
              {TEMPERATURES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTemperature(t.value)}
                  className={`py-2.5 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${
                    temperature === t.value
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span className="text-base">{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 次回アクション日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              次回アクション日
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
            </label>
            <input
              type="date"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
            {nextAction && (
              <button
                type="button"
                onClick={() => setNextAction("")}
                className="mt-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                クリア
              </button>
            )}
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {loading ? "保存中..." : "保存する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
