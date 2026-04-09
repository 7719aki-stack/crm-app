"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard":          { title: "ダッシュボード",   description: "今日の概要と直近の動き" },
  "/customers":          { title: "顧客一覧",         description: "登録顧客の管理と検索" },
  "/sales":              { title: "売上管理",          description: "売上・アップセルの集計" },
  "/settings":           { title: "設定",              description: "アプリの設定と環境構成" },
};

function getTitleInfo(pathname: string) {
  if (pathname.startsWith("/customers/")) {
    return { title: "顧客詳細", description: "顧客情報・鑑定履歴" };
  }
  return PAGE_TITLES[pathname] ?? { title: "Luna CRM", description: "" };
}

function today() {
  return new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

export function Header() {
  const pathname = usePathname();
  const { title, description } = getTitleInfo(pathname);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
      {/* 左：ページタイトル */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 leading-none">{title}</h1>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5 leading-none">{description}</p>
          )}
        </div>
      </div>

      {/* 右：日付 + アバター */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400 hidden sm:block">{today()}</span>

        {/* 通知（ダミー） */}
        <button className="relative w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-500 rounded-full" />
        </button>

        {/* アバター（ダミー） */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-brand-500 flex items-center justify-center cursor-pointer">
          <span className="text-white text-xs font-bold">L</span>
        </div>
      </div>
    </header>
  );
}
