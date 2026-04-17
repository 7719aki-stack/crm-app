"use client";

// ABテスト勝者をアプリ起動時にキャッシュへ読み込む。
// layout.tsx に配置するだけで全ページで有効になる。
import { useEffect } from "react";
import { refreshABWinner } from "@/lib/reminder";

export function ABWinnerInit() {
  useEffect(() => {
    refreshABWinner().catch(() => {});
  }, []);
  return null;
}
