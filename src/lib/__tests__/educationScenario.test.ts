// ─── 教育シナリオ機能テスト ───────────────────────────────────────────────────
// 実行: npm run test:edu

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  EDUCATION_STEPS,
  EDUCATION_SCENARIO_TYPE,
  createEducationSchedules,
  getCustomerScenarioSchedules,
  getDueSchedules,
  markScheduleSent,
} from "../educationScenario";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── インメモリ DB モック ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

let store: Row[] = [];
let nextId = 1;

function makeDb(): SupabaseClient {
  return {
    from(_table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let limitVal = Infinity;

      const chain = {
        select(_cols?: string) { return this; },

        eq(key: string, val: unknown) {
          filters.push((r) => r[key] === val);
          return this;
        },

        in(key: string, vals: unknown[]) {
          filters.push((r) => vals.includes(r[key]));
          return this;
        },

        lte(key: string, val: unknown) {
          filters.push((r) => (r[key] as string) <= (val as string));
          return this;
        },

        limit(n: number) { limitVal = n; return this; },

        order(_key: string, _opts?: unknown) { return this; },

        single() {
          const matched = applyFilters();
          const row = matched[0] ?? null;
          return Promise.resolve({ data: row, error: null });
        },

        insert(data: Row | Row[]) {
          const rows = Array.isArray(data) ? data : [data];
          const inserted = rows.map((r) => ({
            id:         nextId++,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sent_at:    null,
            ...r,
          }));
          store.push(...inserted);
          return {
            select: () => Promise.resolve({ data: inserted, error: null }),
          };
        },

        update(patch: Row) {
          const updateFilters = [...filters];
          const doUpdate = () => {
            let result = [...store];
            for (const f of updateFilters) result = result.filter(f);
            for (const r of result) Object.assign(r, patch);
            return result;
          };

          const updateChain = {
            eq(key: string, val: unknown) {
              updateFilters.push((r: Row) => r[key] === val);
              return this;
            },
            then(resolve: (v: { data: Row[]; error: null }) => unknown) {
              resolve({ data: doUpdate(), error: null });
            },
          };
          return updateChain;
        },

        then(resolve: (v: { data: Row[]; error: null }) => unknown) {
          resolve({ data: applyFilters(), error: null });
        },
      };

      function applyFilters() {
        let result = [...store];
        for (const f of filters) result = result.filter(f);
        return result.slice(0, limitVal);
      }

      return chain;
    },
  } as unknown as SupabaseClient;
}

// ── 各テスト前にストアをリセット ─────────────────────────────────────────────

beforeEach(() => {
  store = [];
  nextId = 1;
});

// ─── 1. EDUCATION_STEPS ───────────────────────────────────────────────────────

describe("EDUCATION_STEPS", () => {
  it("ステップが3件あること", () => {
    assert.equal(EDUCATION_STEPS.length, 3);
  });

  it("遅延日数が 1 / 3 / 7 であること", () => {
    assert.deepEqual(EDUCATION_STEPS.map((s) => s.delay_days), [1, 3, 7]);
  });

  it("step_no が 1 / 2 / 3 であること", () => {
    assert.deepEqual(EDUCATION_STEPS.map((s) => s.step_no), [1, 2, 3]);
  });

  it("全ステップに message_body があること", () => {
    for (const step of EDUCATION_STEPS) {
      assert.ok(step.message_body.length > 0, `step_no=${step.step_no} の message_body が空`);
    }
  });
});

// ─── 2. createEducationSchedules ─────────────────────────────────────────────

describe("createEducationSchedules", () => {
  it("3件のスケジュールを生成すること", async () => {
    const db = makeDb();
    const created = await createEducationSchedules(1, new Date(), db);
    assert.equal(created.length, 3);
  });

  it("scenario_type が education であること", async () => {
    const db = makeDb();
    const created = await createEducationSchedules(1, new Date(), db);
    for (const s of created) assert.equal(s.scenario_type, EDUCATION_SCENARIO_TYPE);
  });

  it("初期 status が pending であること", async () => {
    const db = makeDb();
    const created = await createEducationSchedules(1, new Date(), db);
    for (const s of created) assert.equal(s.status, "pending");
  });

  it("scheduled_at が baseDate からの遅延日数に基づくこと", async () => {
    const db = makeDb();
    const base = new Date("2026-01-01T00:00:00.000Z");
    const created = await createEducationSchedules(1, base, db);

    const expected = [1, 3, 7].map((days) =>
      new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    );

    for (let i = 0; i < created.length; i++) {
      assert.equal(created[i].scheduled_at, expected[i]);
    }
  });

  it("同一顧客に重複して生成しないこと（pending あり）", async () => {
    const db = makeDb();
    await createEducationSchedules(1, new Date(), db);
    const second = await createEducationSchedules(1, new Date(), db);
    assert.equal(second.length, 0, "重複時は空配列を返すこと");
    assert.equal(store.length, 3, "DB に3件のみ存在すること");
  });

  it("異なる顧客は独立して生成できること", async () => {
    const db = makeDb();
    const a = await createEducationSchedules(1, new Date(), db);
    const b = await createEducationSchedules(2, new Date(), db);
    assert.equal(a.length, 3);
    assert.equal(b.length, 3);
    assert.equal(store.length, 6);
  });
});

// ─── 3. getDueSchedules ──────────────────────────────────────────────────────

describe("getDueSchedules", () => {
  it("scheduledAt が now 以前の pending を返すこと", async () => {
    const db = makeDb();
    const past   = new Date("2020-01-01T00:00:00.000Z").toISOString();
    const future = new Date("2099-01-01T00:00:00.000Z").toISOString();
    store.push(
      { id: 1, customer_id: 1, scenario_type: "education", step_no: 1, scheduled_at: past,   status: "pending", message_body: "a", sent_at: null, created_at: past, updated_at: past },
      { id: 2, customer_id: 1, scenario_type: "education", step_no: 2, scheduled_at: future, status: "pending", message_body: "b", sent_at: null, created_at: past, updated_at: past },
    );

    const due = await getDueSchedules(new Date(), db);
    assert.equal(due.length, 1);
    assert.equal(due[0].id, 1);
  });

  it("sent 済みのスケジュールは返さないこと", async () => {
    const db = makeDb();
    const past = new Date("2020-01-01T00:00:00.000Z").toISOString();
    store.push(
      { id: 1, customer_id: 1, scenario_type: "education", step_no: 1, scheduled_at: past, status: "sent",    message_body: "a", sent_at: past, created_at: past, updated_at: past },
      { id: 2, customer_id: 1, scenario_type: "education", step_no: 2, scheduled_at: past, status: "pending", message_body: "b", sent_at: null, created_at: past, updated_at: past },
    );

    const due = await getDueSchedules(new Date(), db);
    assert.equal(due.length, 1);
    assert.equal(due[0].id, 2);
  });

  it("due がなければ空配列を返すこと", async () => {
    const db = makeDb();
    const due = await getDueSchedules(new Date(), db);
    assert.equal(due.length, 0);
  });
});

// ─── 4. markScheduleSent ─────────────────────────────────────────────────────

describe("markScheduleSent", () => {
  it("pending → sent に更新し true を返すこと", async () => {
    const db = makeDb();
    const past = new Date("2020-01-01T00:00:00.000Z").toISOString();
    store.push(
      { id: 1, customer_id: 1, scenario_type: "education", step_no: 1, scheduled_at: past, status: "pending", message_body: "a", sent_at: null, created_at: past, updated_at: past },
    );

    const ok = await markScheduleSent(1, db);
    assert.equal(ok, true);
    assert.equal(store[0].status, "sent");
    assert.ok(store[0].sent_at != null);
  });

  it("既に sent の場合は false を返し二重更新しないこと", async () => {
    const db = makeDb();
    const past = new Date("2020-01-01T00:00:00.000Z").toISOString();
    store.push(
      { id: 1, customer_id: 1, scenario_type: "education", step_no: 1, scheduled_at: past, status: "sent", message_body: "a", sent_at: past, created_at: past, updated_at: past },
    );

    const ok = await markScheduleSent(1, db);
    assert.equal(ok, false);
    assert.equal(store[0].status, "sent");
  });

  it("存在しない id は false を返すこと", async () => {
    const db = makeDb();
    const ok = await markScheduleSent(999, db);
    assert.equal(ok, false);
  });
});

// ─── 5. getCustomerScenarioSchedules ─────────────────────────────────────────

describe("getCustomerScenarioSchedules", () => {
  it("顧客のスケジュールを全件返すこと", async () => {
    const db = makeDb();
    await createEducationSchedules(42, new Date(), db);
    const schedules = await getCustomerScenarioSchedules(42, db);
    assert.equal(schedules.length, 3);
  });

  it("他の顧客のスケジュールを混在させないこと", async () => {
    const db = makeDb();
    await createEducationSchedules(1, new Date(), db);
    await createEducationSchedules(2, new Date(), db);
    const s1 = await getCustomerScenarioSchedules(1, db);
    const s2 = await getCustomerScenarioSchedules(2, db);
    assert.equal(s1.length, 3);
    assert.equal(s2.length, 3);
    assert.ok(s1.every((s) => s.customer_id === 1));
    assert.ok(s2.every((s) => s.customer_id === 2));
  });

  it("スケジュールが0件の場合は空配列を返すこと", async () => {
    const db = makeDb();
    const schedules = await getCustomerScenarioSchedules(99, db);
    assert.equal(schedules.length, 0);
  });
});
