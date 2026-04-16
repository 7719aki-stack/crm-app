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
  resolveSecondReminderDelayHours,
  resolveThirdReminderDelayHours,
  scheduleSecondReminder,
  scheduleThirdReminder,
  markReminderClicked,
  getDueReminders,
  getReminderQueue,
  updateReminderStatus,
  buildDueReminderMessages,
} from "../reminder";

import { sendReminderMessage, sendSecondReminderMessage, sendThirdReminderMessage } from "../generateLineMessage";

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

  it("作成直後の clickedAt は null", () => {
    const item = scheduleReminder(22, "https://example.com/pay", "positive", "cold")!;
    assert.equal(item.clickedAt, null);
  });

  it("クリック時に clickedAt が ISO 文字列で記録される", () => {
    scheduleReminder(23, "https://example.com/pay", "positive", "cold");

    const before = new Date().toISOString();
    markReminderClicked(23);
    const after  = new Date().toISOString();

    const queue   = getReminderQueue();
    const clicked = queue.find((i) => i.customerId === 23)!;

    assert.ok(clicked.hasClicked,                  "hasClicked が true");
    assert.ok(clicked.clickedAt !== null,           "clickedAt が null でない");
    assert.ok(clicked.clickedAt! >= before,         "クリック時刻 >= before");
    assert.ok(clicked.clickedAt! <= after,          "クリック時刻 <= after");
  });

  it("未クリックの item は clickedAt が null のまま", () => {
    scheduleReminder(24, "https://example.com/pay", "hold", "cold");

    const due = getDueReminders(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(due[0].clickedAt, null);
  });

  it("クリック後のリマインダー停止: buildDueReminderMessages で返ってこない", () => {
    scheduleReminder(25, "https://example.com/pay", "positive", "cold");
    markReminderClicked(25);

    const results = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
    assert.equal(results.length, 0, "クリック済みはメッセージ生成対象外");
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

// ─── 7. resolveSecondReminderDelayHours ──────────────────────────────────────

describe("resolveSecondReminderDelayHours", () => {
  it("cold は 24 時間を返す", () => {
    assert.equal(resolveSecondReminderDelayHours("cold"), 24);
  });

  it("warm は 18 時間を返す", () => {
    assert.equal(resolveSecondReminderDelayHours("warm"), 18);
  });

  it("hot は 12 時間を返す", () => {
    assert.equal(resolveSecondReminderDelayHours("hot"), 12);
  });

  it("不明な phase は 24 時間を返す", () => {
    assert.equal(resolveSecondReminderDelayHours("unknown"), 24);
    assert.equal(resolveSecondReminderDelayHours(""),        24);
  });
});

// ─── 8. sendSecondReminderMessage ─────────────────────────────────────────────

describe("sendSecondReminderMessage", () => {
  it("positive の2通目文面: URL と固有文言を含む", () => {
    const url = "https://example.com/pay";
    const msg = sendSecondReminderMessage(url, "positive");

    assert.ok(msg.includes(url),                         "URL が含まれること");
    assert.ok(msg.includes("その後いかがでしょうか"),    "冒頭文言が含まれること");
    assert.ok(msg.includes("動くなら今が流れを変えやすいです"), "末尾文言が含まれること");
  });

  it("positive の2通目に hold 文言は入らない", () => {
    const msg = sendSecondReminderMessage("https://example.com/pay", "positive");
    assert.ok(!msg.includes("迷いがある状態"));
  });

  it("hold の2通目文面: URL と固有文言を含む", () => {
    const url = "https://example.com/pay";
    const msg = sendSecondReminderMessage(url, "hold");

    assert.ok(msg.includes(url),                                       "URL が含まれること");
    assert.ok(msg.includes("まだ迷いがある状態でも大丈夫です"),        "冒頭文言が含まれること");
    assert.ok(msg.includes("先に整理しておくと次の判断がかなり楽になります"), "末尾文言が含まれること");
  });

  it("hold の2通目に positive 文言は入らない", () => {
    const msg = sendSecondReminderMessage("https://example.com/pay", "hold");
    assert.ok(!msg.includes("その後いかがでしょうか"));
  });
});

// ─── 9. scheduleSecondReminder ────────────────────────────────────────────────

describe("scheduleSecondReminder", () => {
  it("1通目作成時に sendCount = 1 になる", () => {
    const item = scheduleReminder(100, "https://example.com/pay", "positive", "cold");
    assert.equal(item!.sendCount, 1);
  });

  it("1通目（未クリック）から2通目が作成される", () => {
    const first  = scheduleReminder(101, "https://example.com/pay", "positive", "cold")!;
    const second = scheduleSecondReminder(first);

    assert.notEqual(second, null);
    assert.equal(second!.sendCount,   2);
    assert.equal(second!.customerId,  101);
    assert.equal(second!.status,      "pending");
    assert.equal(second!.hasClicked,  false);
  });

  it("クリック済み item から2通目は作成されない", () => {
    const first       = scheduleReminder(102, "https://example.com/pay", "positive", "cold")!;
    const clickedItem = { ...first, hasClicked: true };
    const second      = scheduleSecondReminder(clickedItem);

    assert.equal(second, null);
  });

  it("sendCount = 2 の item からさらに3通目は作成されない", () => {
    const first  = scheduleReminder(103, "https://example.com/pay", "positive", "cold")!;
    const second = scheduleSecondReminder(first)!;
    const third  = scheduleSecondReminder(second);

    assert.equal(third, null);
  });

  it("cancelled の1通目から2通目は作成されない", () => {
    const first          = scheduleReminder(109, "https://example.com/pay", "hold", "cold")!;
    const cancelledItem  = { ...first, status: "cancelled" as const };
    const second         = scheduleSecondReminder(cancelledItem);

    assert.equal(second, null);
  });

  it("同一顧客の sendCount=2 が既にある場合は重複作成しない", () => {
    const first  = scheduleReminder(110, "https://example.com/pay", "positive", "warm")!;
    const second = scheduleSecondReminder(first);
    const dup    = scheduleSecondReminder(first);  // 2回目の呼び出し

    assert.notEqual(second, null, "1回目は作成される");
    assert.equal(dup, null,       "2回目は null");
  });

  describe("2通目 scheduledAt の phase 別遅延", () => {
    it("cold: 24 時間後になる", () => {
      const first  = scheduleReminder(104, "https://example.com/pay", "positive", "cold")!;
      const before = Date.now();
      const second = scheduleSecondReminder(first)!;
      const after  = Date.now();

      const scheduled = new Date(second.scheduledAt).getTime();
      const delay     = 24 * 60 * 60 * 1000;
      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("warm: 18 時間後になる", () => {
      const first  = scheduleReminder(105, "https://example.com/pay", "positive", "warm")!;
      const before = Date.now();
      const second = scheduleSecondReminder(first)!;
      const after  = Date.now();

      const scheduled = new Date(second.scheduledAt).getTime();
      const delay     = 18 * 60 * 60 * 1000;
      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("hot: 12 時間後になる", () => {
      const first  = scheduleReminder(106, "https://example.com/pay", "positive", "hot")!;
      const before = Date.now();
      const second = scheduleSecondReminder(first)!;
      const after  = Date.now();

      const scheduled = new Date(second.scheduledAt).getTime();
      const delay     = 12 * 60 * 60 * 1000;
      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });
  });

  describe("buildDueReminderMessages 経由の2通目自動作成", () => {
    it("1通目 due 処理後に2通目が localStorage に作成される", () => {
      const url = "https://example.com/pay";
      scheduleReminder(107, url, "positive", "cold");

      // 1通目が due になる時刻（25h後）
      const results = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
      assert.equal(results.length, 1, "1通目が due");
      updateReminderStatus(results[0].item.id, "sent");

      // 2通目が due になる時刻（さらに 24h 後）
      const now2    = new Date(Date.now() + 25 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
      const due2    = getDueReminders(now2);
      assert.equal(due2.length,          1,        "2通目が due");
      assert.equal(due2[0].sendCount,    2,        "sendCount = 2");
      assert.equal(due2[0].customerId,   107);
    });

    it("2通目 due 処理時に hold の2通目文面が使われる", () => {
      const url = "https://example.com/pay";
      scheduleReminder(108, url, "hold", "warm");

      // 1通目 due（13h後）
      const r1 = buildDueReminderMessages(new Date(Date.now() + 13 * 60 * 60 * 1000));
      assert.equal(r1.length, 1);
      updateReminderStatus(r1[0].item.id, "sent");

      // 2通目 due（さらに 18h 後）
      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 13 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      );
      assert.equal(r2.length, 1);
      assert.ok(r2[0].message.includes("まだ迷いがある状態でも大丈夫です"), "hold 2通目文面");
      assert.ok(r2[0].message.includes(url));
    });

    it("2通目 due 処理時に positive の2通目文面が使われる", () => {
      const url = "https://example.com/pay";
      scheduleReminder(111, url, "positive", "hot");

      // 1通目 due（4h後）
      const r1 = buildDueReminderMessages(new Date(Date.now() + 4 * 60 * 60 * 1000));
      assert.equal(r1.length, 1);
      updateReminderStatus(r1[0].item.id, "sent");

      // 2通目 due（さらに 12h 後）
      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 4 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000),
      );
      assert.equal(r2.length, 1);
      assert.ok(r2[0].message.includes("その後いかがでしょうか"), "positive 2通目文面");
      assert.ok(r2[0].message.includes(url));
    });

    it("クリック済みなら2通目 due 処理で何も返さない", () => {
      const url = "https://example.com/pay";
      scheduleReminder(112, url, "positive", "cold");

      // 1通目 due 処理前にクリック
      markReminderClicked(112);

      const r1 = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
      assert.equal(r1.length, 0, "クリック済みは due に含まれない");

      // 2通目も作成されていないこと
      const due2 = getDueReminders(new Date(Date.now() + 50 * 60 * 60 * 1000));
      assert.equal(due2.length, 0, "2通目も作成されていない");
    });

    it("未到達 scheduledAt の2通目は送信対象外", () => {
      const url = "https://example.com/pay";
      scheduleReminder(113, url, "hold", "cold");

      // 1通目 due
      const r1 = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
      updateReminderStatus(r1[0].item.id, "sent");

      // 2通目は scheduleSecondReminder 呼び出し時の実際の壁時計 + 24h が scheduledAt。
      // 23h 後（未到達）では返ってこないことを確認する。
      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 23 * 60 * 60 * 1000),
      );
      assert.equal(r2.length, 0, "2通目はまだ未到達");
    });

    it("到達済み scheduledAt の2通目は送信対象になる", () => {
      const url = "https://example.com/pay";
      scheduleReminder(114, url, "positive", "warm");

      // 1通目 due（13h後）
      const r1 = buildDueReminderMessages(new Date(Date.now() + 13 * 60 * 60 * 1000));
      updateReminderStatus(r1[0].item.id, "sent");

      // 2通目 due（18h後 = 到達済み）
      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 13 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      );
      assert.equal(r2.length,           1,   "2通目が到達済み");
      assert.equal(r2[0].item.sendCount, 2);
    });
  });
});

// ─── 10. resolveThirdReminderDelayHours ──────────────────────────────────────

describe("resolveThirdReminderDelayHours", () => {
  it("cold は 36 時間を返す", () => {
    assert.equal(resolveThirdReminderDelayHours("cold"), 36);
  });

  it("warm は 24 時間を返す", () => {
    assert.equal(resolveThirdReminderDelayHours("warm"), 24);
  });

  it("hot は 18 時間を返す", () => {
    assert.equal(resolveThirdReminderDelayHours("hot"), 18);
  });

  it("不明な phase は 36 時間を返す", () => {
    assert.equal(resolveThirdReminderDelayHours("unknown"), 36);
    assert.equal(resolveThirdReminderDelayHours(""),        36);
  });
});

// ─── 11. sendThirdReminderMessage ─────────────────────────────────────────────

describe("sendThirdReminderMessage", () => {
  it("positive の3通目文面: URL と固有文言を含む", () => {
    const url = "https://example.com/pay";
    const msg = sendThirdReminderMessage(url, "positive");

    assert.ok(msg.includes(url),                               "URL が含まれること");
    assert.ok(msg.includes("これが最後のご案内になります"),    "冒頭文言が含まれること");
    assert.ok(msg.includes("迷っているなら今ここで一歩進めてください"), "末尾文言が含まれること");
  });

  it("positive の3通目に hold 文言は入らない", () => {
    const msg = sendThirdReminderMessage("https://example.com/pay", "positive");
    assert.ok(!msg.includes("スルーでOK"));
  });

  it("hold の3通目文面: URL と固有文言を含む", () => {
    const url = "https://example.com/pay";
    const msg = sendThirdReminderMessage(url, "hold");

    assert.ok(msg.includes(url),                                    "URL が含まれること");
    assert.ok(msg.includes("ここまで見ていただきありがとうございます"), "冒頭文言が含まれること");
    assert.ok(msg.includes("必要なければスルーでOKです"),             "末尾文言が含まれること");
  });

  it("hold の3通目に positive 文言は入らない", () => {
    const msg = sendThirdReminderMessage("https://example.com/pay", "hold");
    assert.ok(!msg.includes("これが最後のご案内になります"));
  });
});

// ─── 12. scheduleThirdReminder ────────────────────────────────────────────────

describe("scheduleThirdReminder", () => {
  it("2通目（未クリック）から3通目が作成される", () => {
    const first  = scheduleReminder(200, "https://example.com/pay", "positive", "cold")!;
    const second = scheduleSecondReminder(first)!;
    const third  = scheduleThirdReminder(second);

    assert.notEqual(third, null);
    assert.equal(third!.sendCount,  3);
    assert.equal(third!.customerId, 200);
    assert.equal(third!.status,     "pending");
    assert.equal(third!.hasClicked, false);
  });

  it("クリック済み item から3通目は作成されない", () => {
    const first       = scheduleReminder(201, "https://example.com/pay", "positive", "cold")!;
    const second      = scheduleSecondReminder(first)!;
    const clickedItem = { ...second, hasClicked: true };
    const third       = scheduleThirdReminder(clickedItem);

    assert.equal(third, null);
  });

  it("sendCount = 3 の item からさらに4通目は作成されない", () => {
    const first  = scheduleReminder(202, "https://example.com/pay", "positive", "cold")!;
    const second = scheduleSecondReminder(first)!;
    const third  = scheduleThirdReminder(second)!;
    const fourth = scheduleThirdReminder(third);

    assert.equal(fourth, null);
  });

  it("sendCount = 1 の item からは3通目を作れない（2通目経由が必要）", () => {
    const first = scheduleReminder(203, "https://example.com/pay", "positive", "cold")!;
    const third = scheduleThirdReminder(first);

    assert.equal(third, null);
  });

  it("cancelled の2通目から3通目は作成されない", () => {
    const first          = scheduleReminder(204, "https://example.com/pay", "hold", "cold")!;
    const second         = scheduleSecondReminder(first)!;
    const cancelledItem  = { ...second, status: "cancelled" as const };
    const third          = scheduleThirdReminder(cancelledItem);

    assert.equal(third, null);
  });

  it("同一顧客の sendCount=3 が既にある場合は重複作成しない", () => {
    const first  = scheduleReminder(205, "https://example.com/pay", "positive", "warm")!;
    const second = scheduleSecondReminder(first)!;
    const third  = scheduleThirdReminder(second);
    const dup    = scheduleThirdReminder(second);

    assert.notEqual(third, null, "1回目は作成される");
    assert.equal(dup, null,      "2回目は null");
  });

  describe("3通目 scheduledAt の phase 別遅延", () => {
    it("cold: 36 時間後になる", () => {
      const first  = scheduleReminder(206, "https://example.com/pay", "positive", "cold")!;
      const second = scheduleSecondReminder(first)!;
      const before = Date.now();
      const third  = scheduleThirdReminder(second)!;
      const after  = Date.now();

      const scheduled = new Date(third.scheduledAt).getTime();
      const delay     = 36 * 60 * 60 * 1000;
      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("warm: 24 時間後になる", () => {
      const first  = scheduleReminder(207, "https://example.com/pay", "positive", "warm")!;
      const second = scheduleSecondReminder(first)!;
      const before = Date.now();
      const third  = scheduleThirdReminder(second)!;
      const after  = Date.now();

      const scheduled = new Date(third.scheduledAt).getTime();
      const delay     = 24 * 60 * 60 * 1000;
      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });

    it("hot: 18 時間後になる", () => {
      const first  = scheduleReminder(208, "https://example.com/pay", "positive", "hot")!;
      const second = scheduleSecondReminder(first)!;
      const before = Date.now();
      const third  = scheduleThirdReminder(second)!;
      const after  = Date.now();

      const scheduled = new Date(third.scheduledAt).getTime();
      const delay     = 18 * 60 * 60 * 1000;
      assert.ok(scheduled >= before + delay - 1000);
      assert.ok(scheduled <= after  + delay + 1000);
    });
  });

  describe("buildDueReminderMessages 経由の3通目自動作成", () => {
    it("2通目 due 処理後に3通目が localStorage に作成される", () => {
      const url = "https://example.com/pay";
      scheduleReminder(209, url, "positive", "cold");

      // 1通目 due（25h後）→ 2通目スケジュール
      const r1 = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
      assert.equal(r1.length, 1);
      updateReminderStatus(r1[0].item.id, "sent");

      // 2通目 due（さらに 24h 後）→ 3通目スケジュール
      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 25 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000),
      );
      assert.equal(r2.length,           1, "2通目が due");
      assert.equal(r2[0].item.sendCount, 2);
      updateReminderStatus(r2[0].item.id, "sent");

      // 3通目が due になる時刻（さらに 36h 後）
      const r3 = buildDueReminderMessages(
        new Date(Date.now() + 25 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000 + 37 * 60 * 60 * 1000),
      );
      assert.equal(r3.length,           1,   "3通目が due");
      assert.equal(r3[0].item.sendCount, 3);
      assert.equal(r3[0].item.customerId, 209);
    });

    it("3通目 due 処理時に positive の3通目文面が使われる", () => {
      const url = "https://example.com/pay";
      scheduleReminder(210, url, "positive", "hot");

      const r1 = buildDueReminderMessages(new Date(Date.now() + 4 * 60 * 60 * 1000));
      updateReminderStatus(r1[0].item.id, "sent");

      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 4 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000),
      );
      updateReminderStatus(r2[0].item.id, "sent");

      const r3 = buildDueReminderMessages(
        new Date(Date.now() + 4 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      );
      assert.equal(r3.length, 1);
      assert.ok(r3[0].message.includes("これが最後のご案内になります"), "positive 3通目文面");
      assert.ok(r3[0].message.includes(url));
    });

    it("3通目 due 処理時に hold の3通目文面が使われる", () => {
      const url = "https://example.com/pay";
      scheduleReminder(211, url, "hold", "warm");

      const r1 = buildDueReminderMessages(new Date(Date.now() + 13 * 60 * 60 * 1000));
      updateReminderStatus(r1[0].item.id, "sent");

      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 13 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      );
      updateReminderStatus(r2[0].item.id, "sent");

      const r3 = buildDueReminderMessages(
        new Date(Date.now() + 13 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000),
      );
      assert.equal(r3.length, 1);
      assert.ok(r3[0].message.includes("ここまで見ていただきありがとうございます"), "hold 3通目文面");
      assert.ok(r3[0].message.includes(url));
    });

    it("3通目処理後にさらに4通目は作成されない", () => {
      const url = "https://example.com/pay";
      scheduleReminder(212, url, "positive", "cold");

      const r1 = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
      updateReminderStatus(r1[0].item.id, "sent");

      const r2 = buildDueReminderMessages(
        new Date(Date.now() + 25 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000),
      );
      updateReminderStatus(r2[0].item.id, "sent");

      const r3 = buildDueReminderMessages(
        new Date(Date.now() + 25 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000 + 37 * 60 * 60 * 1000),
      );
      assert.equal(r3[0].item.sendCount, 3);
      updateReminderStatus(r3[0].item.id, "sent");

      // さらに先の時刻でも4通目は作成されていない
      const r4 = buildDueReminderMessages(
        new Date(Date.now() + 200 * 60 * 60 * 1000),
      );
      assert.equal(r4.length, 0, "4通目は作成されない");
    });

    it("クリック済みなら3通目は作成されない", () => {
      const url = "https://example.com/pay";
      scheduleReminder(213, url, "positive", "cold");

      // 1通目 due 処理前にクリック
      markReminderClicked(213);

      const r1 = buildDueReminderMessages(new Date(Date.now() + 25 * 60 * 60 * 1000));
      assert.equal(r1.length, 0, "クリック済みは due に含まれない");

      const r3 = getDueReminders(new Date(Date.now() + 200 * 60 * 60 * 1000));
      assert.equal(r3.length, 0, "3通目も作成されていない");
    });
  });
});
