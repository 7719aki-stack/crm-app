// ─── データアクセス層 ─────────────────────────────────────────────────────────
// 現在: localStorage 実装。
// DB移行時: getCustomerRepository() / getSalesRepository() の戻り値を
// API実装クラスに差し替えるだけ。呼び出し元は変更不要。
import {
  DUMMY_CUSTOMERS,
  DUMMY_CUSTOMER_DETAIL,
  type CustomerRow,
  type CustomerDetail,
  type ActionEntry,
} from "@/app/customers/dummyData";
import { DUMMY_SALES, type Sale } from "@/lib/sales";
import type { StatusId } from "@/lib/statuses";

// ─── インターフェース ─────────────────────────────────────────────────────────

export type CustomerPatch = Partial<{
  status:       StatusId;
  tags:         string[];
  notes:        string;
  line_user_id: string;
}>;

export interface CustomerRepository {
  getAll(): CustomerRow[];
  getById(id: number): CustomerDetail | undefined;
  update(id: number, patch: CustomerPatch): void;
  addAction(id: number, action: Omit<ActionEntry, "id">): ActionEntry;
}

export interface SalesRepository {
  getAll(): Sale[];
}

// ─── localStorage ヘルパー ─────────────────────────────────────────────────────

const LS = {
  customers: "crm_customers_v1",
  details:   "crm_customer_details_v1",
  sales:     "crm_sales_v1",
} as const;

function lsRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsWrite(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* QuotaExceededError 等は無視 */ }
}

// ─── localStorage 実装 ────────────────────────────────────────────────────────

const localCustomerRepo: CustomerRepository = {
  getAll() {
    return lsRead<CustomerRow[]>(LS.customers) ?? DUMMY_CUSTOMERS;
  },

  getById(id) {
    const list = lsRead<CustomerDetail[]>(LS.details) ?? [DUMMY_CUSTOMER_DETAIL];
    return list.find((c) => c.id === id);
  },

  update(id, patch) {
    // 顧客一覧の status も更新（一覧画面に即反映）
    const rows = lsRead<CustomerRow[]>(LS.customers) ?? DUMMY_CUSTOMERS;
    lsWrite(LS.customers, rows.map((c) => c.id === id ? { ...c, ...patch } : c));

    // 詳細データを更新（未保存なら dummy から初期化）
    const details = lsRead<CustomerDetail[]>(LS.details) ?? [DUMMY_CUSTOMER_DETAIL];
    const base =
      details.find((c) => c.id === id) ??
      (id === DUMMY_CUSTOMER_DETAIL.id ? DUMMY_CUSTOMER_DETAIL : undefined);
    if (!base) return;

    const updated = { ...base, ...patch };
    const exists  = details.some((c) => c.id === id);
    lsWrite(
      LS.details,
      exists
        ? details.map((c) => c.id === id ? updated : c)
        : [...details, updated],
    );
  },

  addAction(id, action) {
    const details = lsRead<CustomerDetail[]>(LS.details) ?? [DUMMY_CUSTOMER_DETAIL];
    const base =
      details.find((c) => c.id === id) ??
      (id === DUMMY_CUSTOMER_DETAIL.id ? DUMMY_CUSTOMER_DETAIL : undefined);
    if (!base) throw new Error(`顧客 id=${id} が見つかりません`);

    const maxId  = base.actions.reduce((m, a) => Math.max(m, a.id), 0);
    const newEntry: ActionEntry = { ...action, id: maxId + 1 };
    const updated = { ...base, actions: [newEntry, ...base.actions] };
    const exists  = details.some((c) => c.id === id);
    lsWrite(
      LS.details,
      exists
        ? details.map((c) => c.id === id ? updated : c)
        : [...details, updated],
    );
    return newEntry;
  },
};

const localSalesRepo: SalesRepository = {
  getAll() {
    return lsRead<Sale[]>(LS.sales) ?? DUMMY_SALES;
  },
};

// ─── ファクトリ関数 ────────────────────────────────────────────────────────────
// DB移行時: ここの return を API 実装クラスに変えるだけ

export function getCustomerRepository(): CustomerRepository {
  return localCustomerRepo;
}

export function getSalesRepository(): SalesRepository {
  return localSalesRepo;
}
