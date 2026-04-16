// ─── リマインダー機能テスト ───────────────────────────────────────────────────
// 実行: npm test
//
// テスト対象:
//   1. sendReminderMessage    — メッセージ文生成
//   2. scheduleReminder       — スケジュール登録・重複防止
//   3. markReminderClicked    — クリック済みフラグ更新
//   4. getDueReminders        — 24h経過 & 未クリック条件
//   5. buildDueReminderMessages — メッセージ付きの期限到来一覧

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── localStorage モック（Node.js 環境用）──────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem:    (key: string): string | null => store[key] ?? null,
  setItem:    (key: string, value: string): void => { store[key] = value; },
  removeItem: (key: string): void => { delete store[key]; },
  clear:      (): void => { Object.keys(store).forEach((k) => delete store[k]); },
};

// テストファイル読み込み時点でグローバルに注入
(global as unknown as Record<string, unknown>)["window"]       = {};
(global as unknown as Record<string, unknown>)["localStorage"] = localStorageMock;

// ── 静的インポート（tsx で TypeScript を直接処理）─────────────────────────────

import {
  scheduleReminder,
  markReminderClicked,
  getDueReminders,
  updateReminderStatus,
  buildDueReminderMessages,
} from "../reminder";

import { sendReminderMessage } from "../generateLineMessage";

// ── 各テスト前に localStorage をリセット ─────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
});

// ─── 1. sendReminderMessage ───────────────────────────────────────────────────

describe("sendReminderMessage", () => {
  it("URL を含む再送メッセージを返す", () => {
    const url = "https://luna-gemnia.stores.jp/items/test123";
    const msg = sendReminderMessage(url);

    assert.ok(msg.includes(url),          "URL が含まれること");
    assert.ok(msg.includes("お送りします"), "再送の文言が含まれること");
    assert.ok(msg.includes("整理しておく"), "フォロー文言が含まれること");
  });

  it("異なる URL でも正しく埋め込まれる", () => {
    const url = "https://example.com/pay/999";
    const msg = sendReminderMessage(url);
    assert.ok(msg.includes(url));
  });
});

// ─── 2. scheduleReminder ─────────────────────────────────────────────────────

describe("scheduleReminder", () => {
  it("リマインダーを正常に作成する", () => {
    const item = scheduleReminder(1, "https://luna-gemnia.stores.jp/items/aaa");

    assert.notEqual(item, null);
    assert.equal(item!.customerId,  1);
    assert.equal(item!.paymentUrl,  "https://luna-gemnia.stores.jp/items/aaa");
    assert.equal(item!.status,      "pending");
    assert.equal(item!.hasClicked,  false);
  });

  it("scheduledAt が現在時刻の約 24 時間後になっている", () => {
    const before = Date.now();
    const item   = scheduleReminder(2, "https://example.com/pay")!;
    const after  = Date.now();

    const scheduled = new Date(item.scheduledAt).getTime();
    const delay     = 24 * 60 * 60 * 1000;

    assert.ok(scheduled >= before + delay - 1000);
    assert.ok(scheduled <= after  + delay + 1000);
  });

  it("同じ顧客に pending が既にある場合は null を返す（重複防止）", () => {
    scheduleReminder(3, "https://example.com/pay");
    const dup = scheduleReminder(3, "https://example.com/pay2");
    assert.equal(dup, null);
  });

  it("別顧客は独立してスケジュールできる", () => {
    const a = scheduleReminder(10, "https://example.com/a");
    const b = scheduleReminder(11, "https://example.com/b");
    assert.notEqual(a, null);
    assert.notEqual(b, null);
  });
});

// ─── 3. markReminderClicked ──────────────────────────────────────────────────

describe("markReminderClicked", () => {
  it("クリック後は getDueReminders に含まれない", () => {
    scheduleReminder(20, "https://example.com/pay");
    markReminderClicked(20);

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length, 0, "クリック済みはリマインダー対象外");
  });

  it("クリックされていない場合はリマインダー対象のまま", () => {
    scheduleReminder(21, "https://example.com/pay");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length,          1);
    assert.equal(due[0].hasClicked,   false);
  });
});

// ─── 4. getDueReminders ──────────────────────────────────────────────────────

describe("getDueReminders", () => {
  it("24時間未満では返さない", () => {
    scheduleReminder(30, "https://example.com/pay");

    const due = getDueReminders(new Date(Date.now() + 23 * 60 * 60 * 1000));
    assert.equal(due.length, 0);
  });

  it("24時間経過後に返す", () => {
    scheduleReminder(31, "https://example.com/pay");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length,          1);
    assert.equal(due[0].customerId,   31);
  });

  it("sent ステータスは返さない", () => {
    const item = scheduleReminder(32, "https://example.com/pay")!;
    updateReminderStatus(item.id, "sent");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length, 0);
  });

  it("cancelled ステータスは返さない", () => {
    const item = scheduleReminder(33, "https://example.com/pay")!;
    updateReminderStatus(item.id, "cancelled");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length, 0);
  });
});

// ─── 5. buildDueReminderMessages ─────────────────────────────────────────────

describe("buildDueReminderMessages", () => {
  it("期限到来かつ未クリックのアイテムに対してメッセージを生成する", () => {
    const url = "https://luna-gemnia.stores.jp/items/xyz";
    scheduleReminder(40, url);

    const results = buildDueReminderMessages(
      new Date(Date.now() + 25 * 60 * 60 * 1000),
    );

    assert.equal(results.length,                       1);
    assert.equal(results[0].item.customerId,           40);
    assert.ok(results[0].message.includes(url));
    assert.ok(results[0].message.includes("お送りします"));
  });

  it("クリック済みはメッセージ生成対象外", () => {
    scheduleReminder(41, "https://example.com/pay");
    markReminderClicked(41);

    const results = buildDueReminderMessages(
      new Date(Date.now() + 25 * 60 * 60 * 1000),
    );
    assert.equal(results.length, 0);
  });

  it("24時間未満はメッセージ生成対象外", () => {
    scheduleReminder(42, "https://example.com/pay");

    const results = buildDueReminderMessages(
      new Date(Date.now() + 23 * 60 * 60 * 1000),
    );
    assert.equal(results.length, 0);
  });
});
