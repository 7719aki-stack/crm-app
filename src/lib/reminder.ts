// ─── リマインダー管理 ────────────────────────────────────────────────────────
// intent === "positive" または intent === "hold" かつ hasClicked === false の場合に
// phase ごとの遅延時間（cold: 24h / warm: 12h / hot: 3h）後に
// 自動追撃メッセージを送るための スケジュール・追跡ロジック。

import { sendReminderMessage } from "./generateLineMessage";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ReminderStatus = "pending" | "sent" | "cancelled";

export interface ReminderItem {
  id:          string;
  customerId:  number;
  paymentUrl:  string;
  intent:      "positive" | "hold";
  phase:       string;
  scheduledAt: string;  // ISO datetime（intent 検出時 + phase 別遅延）
  hasClicked:  boolean;
  status:      ReminderStatus;
}

// ── 定数 ──────────────────────────────────────────────────────────────────────

const LS_KEY = "crm_reminder_queue_v1";

// ── phase 別遅延解決 ──────────────────────────────────────────────────────────

/**
 * phase に対応するリマインダー遅延時間（時間）を返す。
 * 不明な phase は安全側の 24 時間を返す。
 *
 * - cold => 24h
 * - warm => 12h
 * - hot  =>  3h
 */
export function resolveReminderDelayHours(phase: string): number {
  if (phase === "warm") return 12;
  if (phase === "hot")  return 3;
  return 24; // cold または不明
}

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
 * positive または hold intent 検出時にリマインダーをスケジュールする。
 * それ以外の intent（unknown など）は登録しない。
 * 同じ customerId の pending が既にある場合は重複作成しない。
 * scheduledAt は phase に応じた遅延時間（resolveReminderDelayHours）で算出する。
 *
 * @returns 作成した ReminderItem、対象外 intent または重複時は null
 */
export function scheduleReminder(
  customerId: number,
  paymentUrl: string,
  intent: string,
  phase: string,
): ReminderItem | null {
  if (intent !== "positive" && intent !== "hold") return null;

  const all = lsRead();

  const hasPending = all.some(
    (item) => item.customerId === customerId && item.status === "pending",
  );
  if (hasPending) return null;

  const now      = new Date();
  const delayMs  = resolveReminderDelayHours(phase) * 60 * 60 * 1000;
  const item: ReminderItem = {
    id:          `reminder_${Date.now()}_${customerId}`,
    customerId,
    paymentUrl,
    intent:      intent as "positive" | "hold",
    phase,
    scheduledAt: new Date(now.getTime() + delayMs).toISOString(),
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
    message: sendReminderMessage(item.paymentUrl, item.intent),
  }));
}
