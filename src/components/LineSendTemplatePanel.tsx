"use client";

import { useState, useEffect, useMemo } from "react";
import { MESSAGE_TEMPLATES, TEMPLATES } from "@/lib/messageTemplates";
import { getRecommendedTemplates, type CustomerContext } from "@/lib/recommendTemplates";

const FAV_KEY = "favTemplates";

function tmplKey(catId: string, label: string) {
  return `${catId}/${label}`;
}

// テンプレートIDからカテゴリIDを導出（"first_reply_01" → "first_reply"）
function catIdFromTmplId(id: string): string {
  return id.replace(/_\d+$/, "");
}

// catId + label でフルテンプレートを引く（nextStatus 取得用）
const TMPL_BY_KEY = new Map(
  TEMPLATES.map((t) => [`${catIdFromTmplId(t.id)}/${t.label}`, t])
);

export type TemplateMeta = { nextStatus?: string };

interface Props {
  value:      string;
  onSelect:   (body: string, meta?: TemplateMeta) => void;
  customer?:  CustomerContext;
}

export function LineSendTemplatePanel({ value, onSelect, customer }: Props) {
  const [open,           setOpen]           = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [favorites,      setFavorites]      = useState<Set<string>>(new Set());
  const [searchQuery,    setSearchQuery]    = useState("");

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

  function handleSelect(body: string, e: React.MouseEvent, meta?: TemplateMeta) {
    const finalBody = e.shiftKey ? (value ? `${value}\n${body}` : body) : body;
    onSelect(finalBody, meta);
  }

  // ── よく使うセクション ──────────────────────────────────
  const favTemplates = MESSAGE_TEMPLATES.flatMap((cat) =>
    cat.templates
      .filter((tmpl) => favorites.has(tmplKey(cat.id, tmpl.label)))
      .map((tmpl) => ({
        catId:      cat.id,
        label:      tmpl.label,
        body:       tmpl.body,
        nextStatus: TMPL_BY_KEY.get(tmplKey(cat.id, tmpl.label))?.nextStatus,
      }))
  );

  // ── おすすめテンプレ ────────────────────────────────────
  const recommendedTemplates = useMemo(
    () => customer ? getRecommendedTemplates(customer, 7) : [],
    // customer オブジェクトの中身の変化を追跡するためキーとなる値を列挙
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customer?.category, customer?.status, customer?.tags?.join(","),
     customer?.temperature, customer?.line_user_id, customer?.funnel_stage],
  );

  // ── 検索フィルタリング ──────────────────────────────────
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return MESSAGE_TEMPLATES;
    const q = searchQuery.toLowerCase();
    return MESSAGE_TEMPLATES
      .map((cat) => ({
        ...cat,
        templates: cat.templates.filter(
          (t) => t.label.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.templates.length > 0);
  }, [searchQuery]);

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
          {recommendedTemplates.length > 0 && (
            <span className="text-[10px] font-bold text-brand-500 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full ml-0.5">
              ✨ {recommendedTemplates.length}件
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

          {/* 検索ボックス */}
          <div className="px-3 py-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ラベル・本文で検索…"
                className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-300 placeholder:text-gray-300"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* スクロール可能な内部エリア */}
          <div className="max-h-[52vh] overflow-y-auto overscroll-contain divide-y divide-gray-100">

            {/* ── おすすめテンプレセクション ────────────── */}
            {recommendedTemplates.length > 0 && (
              <div className="px-3 py-3 bg-gradient-to-b from-brand-50/60 to-white">
                <p className="text-[11px] font-bold text-brand-600 mb-2 flex items-center gap-1">
                  ✨ おすすめテンプレ
                  <span className="text-[9px] font-normal text-brand-400">（顧客状況から自動選出）</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendedTemplates.map((tmpl) => {
                    const catId = catIdFromTmplId(tmpl.id);
                    const key   = tmplKey(catId, tmpl.label);
                    return (
                      <RecommendedButton
                        key={key}
                        label={tmpl.label}
                        body={tmpl.body}
                        reasonLabel={tmpl.reasonLabel}
                        isFav={favorites.has(key)}
                        onSelect={(e) => handleSelect(tmpl.body, e, { nextStatus: tmpl.nextStatus })}
                        onToggleFav={(e) => toggleFav(key, e)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── よく使うセクション ──────────────────── */}
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
                      onSelect={(e) => handleSelect(tmpl.body, e, { nextStatus: tmpl.nextStatus })}
                      onToggleFav={(e) => toggleFav(tmplKey(tmpl.catId, tmpl.label), e)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── カテゴリ別アコーディオン ────────────── */}
            {filteredCategories.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                「{searchQuery}」に一致するテンプレはありません
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isOpen   = openCategories.has(cat.id);
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
                              const key        = tmplKey(cat.id, tmpl.label);
                              const fullTmpl   = TMPL_BY_KEY.get(key);
                              return (
                                <TemplateButton
                                  key={key}
                                  label={tmpl.label}
                                  body={tmpl.body}
                                  isFav={favorites.has(key)}
                                  onSelect={(e) => handleSelect(tmpl.body, e, { nextStatus: fullTmpl?.nextStatus })}
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 通常テンプレートボタン ──────────────────────────────────────

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

// ── おすすめテンプレートボタン ──────────────────────────────────

interface RecommendedBtnProps {
  label:       string;
  body:        string;
  reasonLabel: string;
  isFav:       boolean;
  onSelect:    (e: React.MouseEvent) => void;
  onToggleFav: (e: React.MouseEvent) => void;
}

function RecommendedButton({ label, isFav, onSelect, onToggleFav, reasonLabel }: RecommendedBtnProps) {
  return (
    <span className="inline-flex items-center rounded-lg border border-brand-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {reasonLabel && (
        <span className="px-1.5 py-1 text-[8px] font-bold text-brand-500 bg-brand-50 border-r border-brand-100 whitespace-nowrap">
          {reasonLabel}
        </span>
      )}
      <button
        type="button"
        onClick={onSelect}
        title="クリック: 上書き　Shift+クリック: 追記"
        className="pl-2.5 pr-2 py-1.5 text-xs text-gray-700 hover:text-brand-700 hover:bg-brand-50 active:bg-brand-100 transition-colors whitespace-nowrap"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onToggleFav}
        title={isFav ? "お気に入りを解除" : "お気に入りに追加"}
        className={`pr-2 pl-1 py-1.5 text-[11px] transition-colors ${
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
