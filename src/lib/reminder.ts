// ─── リマインダー管理 ────────────────────────────────────────────────────────
// intent === "positive" または intent === "hold" かつ hasClicked === false の場合に
// phase ごとの遅延時間（cold: 24h / warm: 12h / hot: 3h）後に
// 自動追撃メッセージを送るための スケジュール・追跡ロジック。

import { sendReminderMessage, sendSecondReminderMessage } from "./generateLineMessage";

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
  sendCount:   number;  // 1通目=1, 2通目=2
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

/**
 * 2通目リマインダーの phase 別送信間隔（時間）を返す。
 * 不明な phase は安全側の 24 時間を返す。
 *
 * - cold => 24h
 * - warm => 18h
 * - hot  => 12h
 */
export function resolveSecondReminderDelayHours(phase: string): number {
  if (phase === "warm") return 18;
  if (phase === "hot")  return 12;
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
    sendCount:   1,
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
 * 1通目リマインダーが送信済み・未クリックの場合に2通目をスケジュールする。
 *
 * 条件:
 * - intent が positive または hold
 * - sendCount === 1（1通目のみ）
 * - hasClicked === false
 * - status が cancelled でない
 * - 同一顧客の sendCount=2 が既に存在しない（重複防止）
 *
 * @returns 作成した ReminderItem、条件不一致または重複時は null
 */
export function scheduleSecondReminder(firstItem: ReminderItem): ReminderItem | null {
  if (firstItem.intent !== "positive" && firstItem.intent !== "hold") return null;
  if ((firstItem.sendCount ?? 1) !== 1) return null;
  if (firstItem.hasClicked) return null;
  if (firstItem.status === "cancelled") return null;

  const all = lsRead();

  // sendCount=2 の reminder が既に存在する場合は作成しない
  const hasSecond = all.some(
    (item) => item.customerId === firstItem.customerId && (item.sendCount ?? 1) === 2,
  );
  if (hasSecond) return null;

  const now     = new Date();
  const delayMs = resolveSecondReminderDelayHours(firstItem.phase) * 60 * 60 * 1000;
  const item: ReminderItem = {
    id:          `reminder_${Date.now()}_${firstItem.customerId}_2`,
    customerId:  firstItem.customerId,
    paymentUrl:  firstItem.paymentUrl,
    intent:      firstItem.intent,
    phase:       firstItem.phase,
    scheduledAt: new Date(now.getTime() + delayMs).toISOString(),
    hasClicked:  false,
    status:      "pending",
    sendCount:   2,
  };

  lsWrite([...all, item]);
  return item;
}

/**
 * 期限到来・未クリックのリマインダーに対してメッセージ文を生成して返す。
 * sendCount=1 のアイテムは2通目リマインダーを自動作成する。
 * 送信後は呼び出し元で updateReminderStatus(id, "sent") を呼ぶこと。
 *
 * @returns { item, message }[] 送信対象の一覧
 */
export function buildDueReminderMessages(
  now = new Date(),
): { item: ReminderItem; message: string }[] {
  return getDueReminders(now).map((item) => {
    // 1通目処理時に2通目を自動スケジュール
    if ((item.sendCount ?? 1) === 1) {
      scheduleSecondReminder(item);
    }

    return {
      item,
      message: (item.sendCount ?? 1) === 2
        ? sendSecondReminderMessage(item.paymentUrl, item.intent)
        : sendReminderMessage(item.paymentUrl, item.intent),
    };
  });
}
