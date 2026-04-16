// ─── リマインダー機能テスト ───────────────────────────────────────────────────
// 実行: npm test
//
// テスト対象:
//   1. resolveReminderDelayHours — phase 別遅延時間解決
//   2. sendReminderMessage       — メッセージ文生成
//   3. scheduleReminder          — スケジュール登録・重複防止・phase 別 scheduledAt
//   4. markReminderClicked       — クリック済みフラグ更新
//   5. getDueReminders           — scheduledAt 条件・未クリック条件
//   6. buildDueReminderMessages  — メッセージ付きの期限到来一覧

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
  resolveReminderDelayHours,
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

// ─── 1. resolveReminderDelayHours ────────────────────────────────────────────

describe("resolveReminderDelayHours", () => {
  it("cold は 24 時間を返す", () => {
    assert.equal(resolveReminderDelayHours("cold"), 24);
  });

  it("warm は 12 時間を返す", () => {
    assert.equal(resolveReminderDelayHours("warm"), 12);
  });

  it("hot は 3 時間を返す", () => {
    assert.equal(resolveReminderDelayHours("hot"), 3);
  });

  it("不明な phase は安全側の 24 時間を返す", () => {
    assert.equal(resolveReminderDelayHours("unknown"), 24);
    assert.equal(resolveReminderDelayHours(""),        24);
  });
});

// ─── 2. sendReminderMessage ───────────────────────────────────────────────────

describe("sendReminderMessage", () => {
  describe("positive", () => {
    it("URL を含む再送メッセージを返す", () => {
      const url = "https://luna-gemnia.stores.jp/items/test123";
      const msg = sendReminderMessage(url, "positive");

      assert.ok(msg.includes(url),              "URL が含まれること");
      assert.ok(msg.includes("念のためもう一度"), "positive 文言が含まれること");
    });

    it("異なる URL でも正しく埋め込まれる", () => {
      const url = "https://example.com/pay/999";
      const msg = sendReminderMessage(url, "positive");
      assert.ok(msg.includes(url));
    });

    it("positive 用メッセージに「念のためもう一度」が入る", () => {
      const msg = sendReminderMessage("https://example.com/pay", "positive");
      assert.ok(msg.includes("念のためもう一度"));
    });

    it("positive 用メッセージに hold 文言は入らない", () => {
      const msg = sendReminderMessage("https://example.com/pay", "positive");
      assert.ok(!msg.includes("迷っている"));
    });
  });

  describe("hold", () => {
    it("hold 用メッセージに「迷っている」が入る", () => {
      const msg = sendReminderMessage("https://example.com/pay", "hold");
      assert.ok(msg.includes("迷っている"));
    });

    it("hold 用メッセージに URL が含まれる", () => {
      const url = "https://example.com/pay/hold";
      const msg = sendReminderMessage(url, "hold");
      assert.ok(msg.includes(url));
    });

    it("hold 用メッセージに positive 文言は入らない", () => {
      const msg = sendReminderMessage("https://example.com/pay", "hold");
      assert.ok(!msg.includes("念のためもう一度"));
    });
  });
});

// ─── 3. scheduleReminder ─────────────────────────────────────────────────────

describe("scheduleReminder", () => {
  it("positive でリマインダーを正常に作成する", () => {
    const item = scheduleReminder(1, "https://luna-gemnia.stores.jp/items/aaa", "positive", "cold");

    assert.notEqual(item, null);
    assert.equal(item!.customerId,  1);
    assert.equal(item!.paymentUrl,  "https://luna-gemnia.stores.jp/items/aaa");
    assert.equal(item!.intent,      "positive");
    assert.equal(item!.phase,       "cold");
    assert.equal(item!.status,      "pending");
    assert.equal(item!.hasClicked,  false);
  });

  it("hold でリマインダーを正常に作成する", () => {
    const item = scheduleReminder(2, "https://example.com/pay", "hold", "warm");

    assert.notEqual(item, null);
    assert.equal(item!.intent,  "hold");
    assert.equal(item!.phase,   "warm");
    assert.equal(item!.status,  "pending");
  });

  it("unknown intent は登録対象外（null を返す）", () => {
    const item = scheduleReminder(999, "https://example.com/pay", "unknown", "cold");
    assert.equal(item, null);
  });

  describe("phase 別 scheduledAt", () => {
    it("cold は現在時刻の約 24 時間後になる", () => {
      const before = Date.now();
      const item   = scheduleReminder(3, "https://example.com/pay", "positive", "cold")!;
      const after  = Date.now();

      const scheduled = new Date(item.scheduledAt).getTime();
      const delay     = 24 * 60 * 60 * 1000;

      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("warm は現在時刻の約 12 時間後になる", () => {
      const before = Date.now();
      const item   = scheduleReminder(4, "https://example.com/pay", "positive", "warm")!;
      const after  = Date.now();

      const scheduled = new Date(item.scheduledAt).getTime();
      const delay     = 12 * 60 * 60 * 1000;

      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("hot は現在時刻の約 3 時間後になる", () => {
      const before = Date.now();
      const item   = scheduleReminder(5, "https://example.com/pay", "positive", "hot")!;
      const after  = Date.now();

      const scheduled = new Date(item.scheduledAt).getTime();
      const delay     = 3 * 60 * 60 * 1000;

      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("不明 phase は安全側の 24 時間後になる", () => {
      const before = Date.now();
      const item   = scheduleReminder(6, "https://example.com/pay", "positive", "mystery")!;
      const after  = Date.now();

      const scheduled = new Date(item.scheduledAt).getTime();
      const delay     = 24 * 60 * 60 * 1000;

      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });
  });

  it("同じ顧客に pending が既にある場合は null を返す（重複防止）", () => {
    scheduleReminder(10, "https://example.com/pay", "positive", "cold");
    const dup = scheduleReminder(10, "https://example.com/pay2", "positive", "cold");
    assert.equal(dup, null);
  });

  it("別顧客は独立してスケジュールできる", () => {
    const a = scheduleReminder(11, "https://example.com/a", "positive", "cold");
    const b = scheduleReminder(12, "https://example.com/b", "hold",     "warm");
    assert.notEqual(a, null);
    assert.notEqual(b, null);
  });
});

// ─── 4. markReminderClicked ──────────────────────────────────────────────────

describe("markReminderClicked", () => {
  it("クリック後は getDueReminders に含まれない", () => {
    scheduleReminder(20, "https://example.com/pay", "positive", "cold");
    markReminderClicked(20);

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length, 0, "クリック済みはリマインダー対象外");
  });

  it("クリックされていない場合はリマインダー対象のまま", () => {
    scheduleReminder(21, "https://example.com/pay", "hold", "cold");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length,          1);
    assert.equal(due[0].hasClicked,   false);
  });
});

// ─── 5. getDueReminders ──────────────────────────────────────────────────────

describe("getDueReminders", () => {
  describe("scheduledAt 到達判定", () => {
    it("cold: scheduledAt 未到達（23h）では返さない", () => {
      scheduleReminder(30, "https://example.com/pay", "positive", "cold");
      const due = getDueReminders(new Date(Date.now() + 23 * 60 * 60 * 1000));
      assert.equal(due.length, 0);
    });

    it("cold: scheduledAt 到達済み（25h）は返す", () => {
      scheduleReminder(31, "https://example.com/pay", "positive", "cold");
      const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
      assert.equal(due.length,        1);
      assert.equal(due[0].customerId, 31);
    });

    it("warm: scheduledAt 未到達（11h）では返さない", () => {
      scheduleReminder(34, "https://example.com/pay", "positive", "warm");
      const due = getDueReminders(new Date(Date.now() + 11 * 60 * 60 * 1000));
      assert.equal(due.length, 0);
    });

    it("warm: scheduledAt 到達済み（13h）は返す", () => {
      scheduleReminder(35, "https://example.com/pay", "positive", "warm");
      const due = getDueReminders(new Date(Date.now() + 13 * 60 * 60 * 1000));
      assert.equal(due.length,        1);
      assert.equal(due[0].customerId, 35);
    });

    it("hot: scheduledAt 未到達（2h）では返さない", () => {
      scheduleReminder(36, "https://example.com/pay", "positive", "hot");
      const due = getDueReminders(new Date(Date.now() + 2 * 60 * 60 * 1000));
      assert.equal(due.length, 0);
    });

    it("hot: scheduledAt 到達済み（4h）は返す", () => {
      scheduleReminder(37, "https://example.com/pay", "positive", "hot");
      const due = getDueReminders(new Date(Date.now() + 4 * 60 * 60 * 1000));
      assert.equal(due.length,        1);
      assert.equal(due[0].customerId, 37);
    });
  });

  it("sent ステータスは返さない", () => {
    const item = scheduleReminder(32, "https://example.com/pay", "hold", "cold")!;
    updateReminderStatus(item.id, "sent");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length, 0);
  });

  it("cancelled ステータスは返さない", () => {
    const item = scheduleReminder(33, "https://example.com/pay", "hold", "cold")!;
    updateReminderStatus(item.id, "cancelled");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due.length, 0);
  });
});

// ─── 6. buildDueReminderMessages ─────────────────────────────────────────────

describe("buildDueReminderMessages", () => {
  it("positive (cold): 期限到来かつ未クリックのアイテムに positive 文面を生成する", () => {
    const url = "https://luna-gemnia.stores.jp/items/xyz";
    scheduleReminder(40, url, "positive", "cold");

    const results = buildDueReminderMessages(
      new Date(Date.now() + 25 * 60 * 60 * 1000),
    );

    assert.equal(results.length,             1);
    assert.equal(results[0].item.customerId, 40);
    assert.ok(results[0].message.includes(url));
    assert.ok(results[0].message.includes("念のためもう一度"));
  });

  it("hold (warm): 期限到来かつ未クリックのアイテムに hold 文面を生成する", () => {
    const url = "https://luna-gemnia.stores.jp/items/hold";
    scheduleReminder(43, url, "hold", "warm");

    const results = buildDueReminderMessages(
      new Date(Date.now() + 13 * 60 * 60 * 1000),
    );

    assert.equal(results.length,             1);
    assert.equal(results[0].item.customerId, 43);
    assert.ok(results[0].message.includes(url));
    assert.ok(results[0].message.includes("迷っている"));
  });

  it("クリック済みはメッセージ生成対象外", () => {
    scheduleReminder(41, "https://example.com/pay", "positive", "cold");
    markReminderClicked(41);

    const results = buildDueReminderMessages(
      new Date(Date.now() + 25 * 60 * 60 * 1000),
    );
    assert.equal(results.length, 0);
  });

  it("scheduledAt 未到達はメッセージ生成対象外（cold: 23h 時点）", () => {
    scheduleReminder(42, "https://example.com/pay", "hold", "cold");

    const results = buildDueReminderMessages(
      new Date(Date.now() + 23 * 60 * 60 * 1000),
    );
    assert.equal(results.length, 0);
  });
});
