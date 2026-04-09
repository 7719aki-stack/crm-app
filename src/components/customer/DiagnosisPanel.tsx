"use client";

import { useState, useEffect } from "react";
import {
  saveDiagnosisRecord,
  getDiagnosisRecords,
  deleteDiagnosisRecord,
  DIAGNOSIS_TYPE_LABELS,
  type DiagnosisRecord,
  type DiagnosisRecordType,
} from "@/lib/storage/diagnosisRecords";

const TYPES: DiagnosisRecordType[] = ["free", "paid", "upsell", "premium"];

type Props = {
  customerId: number | string;
  customerName: string;
  tags: string[];
};

export default function DiagnosisPanel({ customerId, customerName, tags }: Props) {
  const [text,    setText]    = useState("");
  const [type,    setType]    = useState<DiagnosisRecordType>("free");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [records, setRecords] = useState<DiagnosisRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // マウント時 + 保存後に履歴を読み込む
  function loadRecords() {
    setRecords(getDiagnosisRecords(String(customerId)));
  }

  useEffect(() => {
    loadRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    saveDiagnosisRecord({
      customerId: String(customerId),
      customerName,
      type,
      text: text.trim(),
      tags,
    });
    setText("");
    loadRecords();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDelete(id: string) {
    deleteDiagnosisRecord(id);
    loadRecords();
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* 鑑定種別セレクタ */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
          鑑定種別
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                type === t
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-brand-300"
              }`}
            >
              {DIAGNOSIS_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 鑑定本文入力 */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
          鑑定本文
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`${DIAGNOSIS_TYPE_LABELS[type]}の本文をここに書きます&#10;送信文ドラフトとは別管理です`}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none placeholder:text-gray-300"
        />
        <p className="text-[10px] text-gray-300 text-right mt-0.5">
          {text.length > 0 ? `${text.length} 文字` : ""}
        </p>
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={!hasText || saving}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          saved
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {saved ? "保存しました" : saving ? "保存中…" : `${DIAGNOSIS_TYPE_LABELS[type]}として保存`}
      </button>

      {/* 直近の鑑定履歴 */}
      {records.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
            保存済み鑑定履歴 ({records.length}件)
          </p>
          <div className="space-y-2">
            {records.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-100 bg-gray-50 overflow-hidden"
              >
                {/* ヘッダー行 */}
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.type === "free"
                          ? "bg-blue-100 text-blue-700"
                          : r.type === "paid"
                          ? "bg-brand-100 text-brand-700"
                          : r.type === "upsell"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {DIAGNOSIS_TYPE_LABELS[r.type]}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                    {expanded !== r.id && (
                      <span className="text-xs text-gray-500 truncate">
                        {r.text.slice(0, 30)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id);
                      }}
                      className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
                    >
                      削除
                    </button>
                    <svg
                      className={`w-3 h-3 text-gray-400 transition-transform ${expanded === r.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {/* 展開時の本文 */}
                {expanded === r.id && (
                  <div className="px-3 pb-3">
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {r.text}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {records.length > 5 && (
              <p className="text-[10px] text-gray-300 text-right">
                他 {records.length - 5} 件は履歴から確認できます
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
