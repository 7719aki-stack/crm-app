"use client";

import { useState } from "react";
import { MESSAGE_TEMPLATES } from "@/lib/messageTemplates";

interface Props {
  onSelect: (body: string) => void;
  onAppend: (body: string) => void;
}

export function LineSendTemplatePanel({ onSelect, onAppend }: Props) {
  const [open, setOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div>
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
                      {cat.templates.map((tmpl) => (
                        <button
                          key={tmpl.label}
                          type="button"
                          onClick={(e) => {
                            if (e.shiftKey) {
                              onAppend(tmpl.body);
                            } else {
                              onSelect(tmpl.body);
                            }
                          }}
                          title="クリック: 上書き　Shift+クリック: 追記"
                          className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-white text-gray-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-colors whitespace-nowrap"
                        >
                          {tmpl.label}
                        </button>
                      ))}
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
