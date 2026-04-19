"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ── Icons ──────────────────────────────────────────────
function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="12" cy="8" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  );
}
function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// ── Nav config ─────────────────────────────────────────
type NavItem = {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  sub?: boolean;
};

const mainNav: NavItem[] = [
  { label: "ダッシュボード", href: "/dashboard",  icon: IconDashboard },
  { label: "顧客一覧",       href: "/customers",  icon: IconUsers },
  { label: "顧客詳細",       href: "/customers",  icon: IconUser, sub: true },
  { label: "売上管理",       href: "/sales",      icon: IconChart },
];

const bottomNav: NavItem[] = [
  { label: "設定", href: "/settings", icon: IconSettings },
];

// ── NavLink（Sidebar外で定義して毎レンダーの再生成を防ぐ）────
function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = item.sub
    ? pathname.startsWith("/customers/")
    : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150
        ${item.sub ? "ml-4" : ""}
        ${active
          ? "bg-brand-500/15 text-brand-300 border-l-2 border-brand-400 pl-[10px]"
          : "text-gray-400 hover:text-gray-100 hover:bg-white/5 border-l-2 border-transparent"
        }
      `}
    >
      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${active ? "text-brand-400" : "text-gray-500 group-hover:text-gray-300"}`} />
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
    </Link>
  );
}

// ── Component ──────────────────────────────────────────
export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 bg-[#0d1117] flex flex-col h-screen sticky top-0">
      {/* ロゴ */}
      <div className="h-16 flex items-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/30">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Luna CRM</p>
            <p className="text-gray-500 text-[10px] mt-0.5 leading-none">恋愛鑑定 管理</p>
          </div>
        </div>
      </div>

      {/* メインナビ */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
          メニュー
        </p>
        {mainNav.map((item) => (
          <NavLink key={`${item.href}-${item.label}`} item={item} />
        ))}
      </nav>

      {/* ボトムナビ */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3 space-y-0.5">
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        {/* ユーザー欄（ダミー） */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-brand-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <div className="min-w-0">
            <p className="text-gray-300 text-xs font-medium truncate">Luna</p>
            <p className="text-gray-600 text-[10px] truncate">オーナー</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
