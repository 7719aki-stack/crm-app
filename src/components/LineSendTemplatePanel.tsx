"use client";

import { useState, useEffect } from "react";
import { MESSAGE_TEMPLATES } from "@/lib/messageTemplates";

const FAV_KEY = "favTemplates";

function tmplKey(catId: string, label: string) {
  return `${catId}/${label}`;
}

interface Props {
  value: string;
  onSelect: (body: string) => void;
}

export function LineSendTemplatePanel({ value, onSelect }: Props) {
  const [open,           setOpen]           = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [favorites,      setFavorites]      = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  function toggleFav(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeAll() {
    setOpenCategories(new Set());
  }

  function handleSelect(body: string, e: React.MouseEvent) {
    if (e.shiftKey) {
      onSelect(value ? `${value}\n${body}` : body);
    } else {
      onSelect(body);
    }
  }

  const favTemplates = MESSAGE_TEMPLATES.flatMap((cat) =>
    cat.templates
      .filter((tmpl) => favorites.has(tmplKey(cat.id, tmpl.label)))
      .map((tmpl) => ({ catId: cat.id, label: tmpl.label, body: tmpl.body }))
  );

  const anyOpen = openCategories.size > 0;

  return (
    <div>
      {/* トグルボタン */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
          </svg>
          テンプレを選ぶ
          {favTemplates.length > 0 && (
            <span className="text-[10px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full ml-0.5">
              ⭐ {favTemplates.length}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展開パネル */}
      {open && (
        <div className="mt-1.5 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

          {/* ツールバー */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/80">
            <p className="text-[10px] text-gray-400">
              クリック: 上書き　<kbd className="font-mono bg-gray-100 px-1 rounded text-[9px]">Shift</kbd>+クリック: 追記
            </p>
            {anyOpen && (
              <button
                type="button"
                onClick={closeAll}
                className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                全て閉じる
              </button>
            )}
          </div>

          {/* スクロール可能な内部エリア */}
          <div className="max-h-[52vh] overflow-y-auto overscroll-contain divide-y divide-gray-100">

            {/* よく使うセクション */}
            {favTemplates.length > 0 && (
              <div className="px-3 py-3 bg-amber-50/50">
                <p className="text-[11px] font-bold text-amber-600 mb-2">⭐ よく使う</p>
                <div className="flex flex-wrap gap-1.5">
                  {favTemplates.map((tmpl) => (
                    <TemplateButton
                      key={tmplKey(tmpl.catId, tmpl.label)}
                      label={tmpl.label}
                      body={tmpl.body}
                      isFav={true}
                      onSelect={(e) => handleSelect(tmpl.body, e)}
                      onToggleFav={(e) => toggleFav(tmplKey(tmpl.catId, tmpl.label), e)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* カテゴリ別アコーディオン */}
            {MESSAGE_TEMPLATES.map((cat) => {
              const isOpen = openCategories.has(cat.id);
              const favCount = cat.templates.filter((t) => favorites.has(tmplKey(cat.id, t.label))).length;
              return (
                <div key={cat.id}>
                  {/* カテゴリヘッダー */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-3 min-h-[44px] transition-colors ${
                      isOpen ? "bg-brand-50/60" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isOpen ? "text-brand-700" : "text-gray-700"}`}>
                        {cat.name}
                      </span>
                      {favCount > 0 && (
                        <span className="text-[9px] text-amber-500">⭐{favCount}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{cat.templates.length}件</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-brand-500" : "text-gray-400"
                        }`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* アコーディオン本体（grid トリックでスムーズに開閉） */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3 pt-2 pb-3 bg-gray-50/40">
                        <div className="flex flex-wrap gap-1.5">
                          {cat.templates.map((tmpl) => {
                            const key = tmplKey(cat.id, tmpl.label);
                            return (
                              <TemplateButton
                                key={key}
                                label={tmpl.label}
                                body={tmpl.body}
                                isFav={favorites.has(key)}
                                onSelect={(e) => handleSelect(tmpl.body, e)}
                                onToggleFav={(e) => toggleFav(key, e)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── テンプレートボタン ──────────────────────────────────────────

interface TemplateBtnProps {
  label:       string;
  body:        string;
  isFav:       boolean;
  onSelect:    (e: React.MouseEvent) => void;
  onToggleFav: (e: React.MouseEvent) => void;
}

function TemplateButton({ label, isFav, onSelect, onToggleFav }: TemplateBtnProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow transition-shadow">
      <button
        type="button"
        onClick={onSelect}
        title="クリック: 上書き　Shift+クリック: 追記"
        className="pl-3 pr-2 py-1.5 text-xs text-gray-600 hover:text-brand-700 hover:bg-brand-50 active:bg-brand-100 transition-colors whitespace-nowrap"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onToggleFav}
        title={isFav ? "お気に入りを解除" : "お気に入りに追加"}
        className={`pr-2.5 pl-1 py-1.5 text-[11px] transition-colors ${
          isFav
            ? "text-amber-400 hover:text-amber-500"
            : "text-gray-300 hover:text-amber-400"
        }`}
      >
        ⭐
      </button>
    </span>
  );
}
