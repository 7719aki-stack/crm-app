// ─── リマインダー管理 ────────────────────────────────────────────────────────
// intent === "positive" かつ hasClicked === false の場合に
// 24時間後に自動追撃メッセージを送るための スケジュール・追跡ロジック。

import { sendReminderMessage } from "./generateLineMessage";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ReminderStatus = "pending" | "sent" | "cancelled";

export interface ReminderItem {
  id:          string;
  customerId:  number;
  paymentUrl:  string;
  scheduledAt: string;  // ISO datetime（positive 検出時 + 24h）
  hasClicked:  boolean;
  status:      ReminderStatus;
}

// ── 定数 ──────────────────────────────────────────────────────────────────────

const LS_KEY           = "crm_reminder_queue_v1";
const REMINDER_DELAY_MS = 24 * 60 * 60 * 1000; // 24時間

// ── localStorage ヘルパー ─────────────────────────────────────────────────────

function lsRead(): ReminderItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ReminderItem[]) : [];
  } catch { return []; }
}

function lsWrite(items: ReminderItem[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

// ── 公開関数 ──────────────────────────────────────────────────────────────────

/**
 * positive intent 検出時にリマインダーをスケジュールする。
 * 同じ customerId の pending が既にある場合は重複作成しない。
 *
 * @returns 作成した ReminderItem、重複時は null
 */
export function scheduleReminder(
  customerId: number,
  paymentUrl: string,
): ReminderItem | null {
  const all = lsRead();

  const hasPending = all.some(
    (item) => item.customerId === customerId && item.status === "pending",
  );
  if (hasPending) return null;

  const now  = new Date();
  const item: ReminderItem = {
    id:          `reminder_${Date.now()}_${customerId}`,
    customerId,
    paymentUrl,
    scheduledAt: new Date(now.getTime() + REMINDER_DELAY_MS).toISOString(),
    hasClicked:  false,
    status:      "pending",
  };

  lsWrite([...all, item]);
  return item;
}

/**
 * 顧客が決済URLをクリックしたことを記録する。
 * クリック済みの場合、リマインダーは送信されない。
 */
export function markReminderClicked(customerId: number): void {
  const all = lsRead();
  lsWrite(
    all.map((item) =>
      item.customerId === customerId && item.status === "pending"
        ? { ...item, hasClicked: true }
        : item,
    ),
  );
}

/**
 * 送信すべきリマインダーを返す。
 * 条件: status === "pending" かつ hasClicked === false かつ scheduledAt <= now
 */
export function getDueReminders(now = new Date()): ReminderItem[] {
  return lsRead().filter(
    (item) =>
      item.status     === "pending" &&
      item.hasClicked === false     &&
      new Date(item.scheduledAt) <= now,
  );
}

/**
 * 指定 id のステータスを更新する。
 */
export function updateReminderStatus(id: string, status: ReminderStatus): void {
  const all = lsRead();
  lsWrite(all.map((item) => (item.id === id ? { ...item, status } : item)));
}

/**
 * 期限到来・未クリックのリマインダーに対してメッセージ文を生成して返す。
 * 送信後は呼び出し元で updateReminderStatus(id, "sent") を呼ぶこと。
 *
 * @returns { item, message }[] 送信対象の一覧
 */
export function buildDueReminderMessages(
  now = new Date(),
): { item: ReminderItem; message: string }[] {
  return getDueReminders(now).map((item) => ({
    item,
    message: sendReminderMessage(item.paymentUrl),
  }));
}
