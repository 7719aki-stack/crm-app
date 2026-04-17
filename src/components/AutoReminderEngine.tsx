"use client";

// ─── 自動追撃エンジン ─────────────────────────────────────────
// 決済URLをクリックしたが未購入の顧客に自動でLINEリマインドを送る。
//
// タイミング:
//   クリックから 30分後 → 1回目リマインド
//   クリックから 24時間後 → 2回目リマインド（購入なければ）
//
// layout.tsx に設置するだけで全ページで有効。

import { useEffect } from "react";
import {
  getClickFollowUps,
  markFollowUpDone,
  markFollowUpReminded,
} from "@/lib/reminder";

const POLL_INTERVAL_MS = 60_000; // 1分ごとにチェック
const DELAY_30M_MS     = 30 * 60 * 1000;
const DELAY_24H_MS     = 24 * 60 * 60 * 1000;

export function AutoReminderEngine() {
  useEffect(() => {
    const check = () => { void runFollowUpCheck(); };
    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}

async function runFollowUpCheck(): Promise<void> {
  const followUps = getClickFollowUps();
  if (followUps.length === 0) return;

  const now = Date.now();

  for (const fu of followUps) {
    const clickedMs = new Date(fu.clickedAt).getTime();
    const elapsed   = now - clickedMs;

    // ── 購入済みかチェック ────────────────────────────────
    const purchased = await checkPurchased(fu.customerId);
    if (purchased) {
      markFollowUpDone(fu.customerId);
      continue;
    }

    // ── 30分後リマインド ──────────────────────────────────
    if (!fu.remindedAt30m && elapsed >= DELAY_30M_MS) {
      const ok = await sendFollowUpRemind(fu.customerId);
      if (ok) markFollowUpReminded(fu.customerId, "30m");
    }

    // ── 24時間後リマインド（30m送信済みかつ24h経過） ──────
    if (fu.remindedAt30m && !fu.remindedAt24h && elapsed >= DELAY_24H_MS) {
      const ok = await sendFollowUpRemind(fu.customerId);
      if (ok) markFollowUpReminded(fu.customerId, "24h");
    }
  }
}

/** /api/customers/[id] から購入状況を確認 */
async function checkPurchased(customerId: number): Promise<boolean> {
  try {
    const res  = await fetch(`/api/customers/${customerId}`);
    if (!res.ok) return false;
    const data = await res.json() as { total_amount?: number };
    return (data.total_amount ?? 0) > 0;
  } catch {
    return false;
  }
}

/** /api/upsell を叩いてリマインドLINEを送信（失敗しても続行） */
async function sendFollowUpRemind(customerId: number): Promise<boolean> {
  try {
    const res = await fetch("/api/upsell", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ customer_id: customerId, type: "reminder" }),
    });
    // 422 = LINE未設定 → 正常に続行（送れないだけ）
    if (res.status === 422) return true;
    return res.ok;
  } catch {
    return false;
  }
}
