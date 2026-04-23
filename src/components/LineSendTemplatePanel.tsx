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

  return (
    <div>
      {/* トグルボタン */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
          </svg>
          テンプレを選ぶ
          {favTemplates.length > 0 && (
            <span className="ml-1 text-amber-400">⭐{favTemplates.length}</span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-100 bg-white overflow-hidden divide-y divide-gray-50">

          {/* よく使うセクション */}
          {favTemplates.length > 0 && (
            <div className="px-3 py-3 bg-amber-50/60">
              <p className="text-[11px] font-semibold text-amber-600 mb-2 flex items-center gap-1">
                ⭐ よく使う
              </p>
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

          {/* カテゴリ別セクション */}
          {MESSAGE_TEMPLATES.map((cat) => {
            const isOpen = openCategories.has(cat.id);
            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{cat.templates.length}件</span>
                    <svg
                      className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-1.5 bg-gray-50/40">
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
                    <p className="text-[10px] text-gray-400">Shift+クリックで末尾に追記</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TemplateBtnProps {
  label:       string;
  body:        string;
  isFav:       boolean;
  onSelect:    (e: React.MouseEvent) => void;
  onToggleFav: (e: React.MouseEvent) => void;
}

function TemplateButton({ label, isFav, onSelect, onToggleFav }: TemplateBtnProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onSelect}
        title="クリック: 上書き　Shift+クリック: 追記"
        className="px-2.5 py-1 text-xs text-gray-600 hover:text-brand-700 hover:bg-brand-50 transition-colors whitespace-nowrap"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onToggleFav}
        title={isFav ? "お気に入りを解除" : "お気に入りに追加"}
        className={`pr-2 pl-1 py-1 text-[11px] transition-colors ${
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
