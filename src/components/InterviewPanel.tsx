"use client";

import { useEffect, useState } from "react";
import {
  getCustomerInterview,
  saveCustomerInterview,
  detectConcernTags,
  type InterviewInput,
} from "@/lib/interview";

interface Props {
  customerId:    number;
  currentTags?:  string[];
  onTagsChange?: (newTags: string[]) => void;
}

const EMPTY: InterviewInput = { clientName: "", birthDate: "", concern: "" };

export function InterviewPanel({ customerId, currentTags, onTagsChange }: Props) {
  const [form,      setForm]      = useState<InterviewInput>(EMPTY);
  const [savedAt,   setSavedAt]   = useState<string | null>(null);
  const [dirty,     setDirty]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // 初期ロード
  useEffect(() => {
    const saved = getCustomerInterview(customerId);
    if (saved) {
      setForm({ clientName: saved.clientName, birthDate: saved.birthDate, concern: saved.concern });
      setSavedAt(saved.updatedAt);
    } else {
      setForm(EMPTY);
      setSavedAt(null);
    }
    setDirty(false);
  }, [customerId]);

  function handleChange(field: keyof InterviewInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setShowSaved(false);
  }

  function handleSave() {
    if (saving) return;
    setSaving(true);
    const result = saveCustomerInterview(customerId, form);
    setSavedAt(result.updatedAt);
    setDirty(false);
    setSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2500);

    // 悩み内容からタグを自動検出して追加
    if (onTagsChange) {
      const detected = detectConcernTags(form.concern);
      if (detected.length > 0) {
        const merged = Array.from(new Set([...(currentTags ?? []), ...detected]));
        onTagsChange(merged);
      }
    }
  }

  function formatSavedAt(iso: string): string {
    return new Date(iso).toLocaleString("ja-JP", {
      month: "numeric", day: "numeric",
      hour:  "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      {/* 名前 */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          名前
        </label>
        <input
          type="text"
          value={form.clientName}
          onChange={(e) => handleChange("clientName", e.target.value)}
          placeholder="例：花子"
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      {/* 生年月日 */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          生年月日
        </label>
        <input
          type="date"
          value={form.birthDate}
          onChange={(e) => handleChange("birthDate", e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      {/* 悩み内容 */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          悩み内容
        </label>
        <textarea
          value={form.concern}
          onChange={(e) => handleChange("concern", e.target.value)}
          placeholder="例：元彼との復縁を希望しています。半年前に別れて…"
          rows={4}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none"
        />
      </div>

      {/* 保存ボタン & ステータス */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-gray-400">
          {showSaved ? (
            <span className="text-emerald-600 font-medium">保存しました ✓</span>
          ) : savedAt ? (
            <span>最終保存: {formatSavedAt(savedAt)}</span>
          ) : (
            <span>未保存</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            dirty
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
