import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "love-crm.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      display_name   TEXT,
      contact        TEXT,
      status         TEXT NOT NULL DEFAULT 'new_reg',
      tags           TEXT NOT NULL DEFAULT '[]',
      notes          TEXT,
      line_id        TEXT,
      line_user_id   TEXT UNIQUE,
      picture_url    TEXT,
      status_message TEXT,
      category       TEXT NOT NULL DEFAULT '片思い',
      crisis_level   INTEGER NOT NULL DEFAULT 1,
      temperature    TEXT NOT NULL DEFAULT 'cool',
      next_action    TEXT,
      total_amount   INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      source      TEXT NOT NULL DEFAULT 'line',
      direction   TEXT NOT NULL DEFAULT 'inbound',
      text        TEXT NOT NULL DEFAULT '',
      raw_type    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS appraisals (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL,
      type         TEXT NOT NULL DEFAULT '恋愛鑑定',
      status       TEXT NOT NULL DEFAULT '受付中',
      price        INTEGER NOT NULL DEFAULT 0,
      paid         INTEGER NOT NULL DEFAULT 0,
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      delivered_at TEXT
    );
    CREATE TABLE IF NOT EXISTS scenario_schedules (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id   INTEGER NOT NULL,
      scenario_type TEXT NOT NULL DEFAULT 'education',
      step_no       INTEGER NOT NULL,
      scheduled_at  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      message_body  TEXT NOT NULL DEFAULT '',
      sent_at       TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── 型 ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Result<T> = { data: T; error: null } | { data: null; error: Error };

// ─── クエリビルダー ───────────────────────────────────────────────────────────

class QueryBuilder {
  private _table: string;
  private _op: "select" | "insert" | "update" | "delete" = "select";
  private _cols = "*";
  private _wheres: Array<{ col: string; val: unknown; op?: string; inVals?: unknown[] }> = [];
  private _orderCol: string | null = null;
  private _orderAsc = true;
  private _limitVal: number | null = null;
  private _insertData: Row | Row[] | null = null;
  private _updateData: Row | null = null;
  private _returnRow = false;

  constructor(table: string) {
    this._table = table;
  }

  select(cols = "*"): this {
    if (this._op === "insert") {
      this._returnRow = true;
      this._cols = cols;
    } else {
      this._op = "select";
      this._cols = cols;
    }
    return this;
  }

  insert(data: Row | Row[]): this {
    this._op = "insert";
    this._insertData = data;
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this._wheres.push({ col, val: null, op: "IN", inVals: vals });
    return this;
  }

  update(data: Row): this {
    this._op = "update";
    this._updateData = data;
    return this;
  }

  delete(): this {
    this._op = "delete";
    return this;
  }

  eq(col: string, val: unknown): this {
    this._wheres.push({ col, val });
    return this;
  }

  lte(col: string, val: unknown): this {
    this._wheres.push({ col, val, op: "<=" });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number): this {
    this._limitVal = n;
    return this;
  }

  // ─── 実行ヘルパー ──────────────────────────────────────────────────────────

  private buildWhere(): { clause: string; params: unknown[] } {
    if (this._wheres.length === 0) return { clause: "", params: [] };
    const params: unknown[] = [];
    const parts = this._wheres.map((w) => {
      if (w.op === "IN" && w.inVals) {
        params.push(...w.inVals);
        return `${w.col} IN (${w.inVals.map(() => "?").join(", ")})`;
      }
      params.push(w.val);
      return `${w.col} ${w.op ?? "="} ?`;
    });
    return { clause: " WHERE " + parts.join(" AND "), params };
  }

  private buildOrder(): string {
    if (!this._orderCol) return "";
    return ` ORDER BY ${this._orderCol} ${this._orderAsc ? "ASC" : "DESC"}`;
  }

  private buildLimit(): string {
    return this._limitVal !== null ? ` LIMIT ${this._limitVal}` : "";
  }

  // Supabase の "customers(name)" JOIN 記法はスキップし、通常カラムのみ使う
  private parseCols(): string {
    if (!this._cols || this._cols === "*") return "*";
    const cols = this._cols
      .split(",")
      .map((c) => c.trim())
      .filter((c) => !/^\w+\(/.test(c)); // "table(col)" 形式を除去
    return cols.length > 0 ? cols.join(", ") : "*";
  }

  private runSelect(): Row[] {
    const db = getDb();
    const { clause, params } = this.buildWhere();
    const sql =
      `SELECT ${this.parseCols()} FROM ${this._table}` +
      clause +
      this.buildOrder() +
      this.buildLimit();
    return db.prepare(sql).all(...params) as Row[];
  }

  private runInsert(): Row | Row[] | null {
    const db = getDb();
    const rawData = this._insertData!;
    const rows = Array.isArray(rawData) ? rawData : [rawData];
    if (rows.length === 0) throw new Error("insert data is empty");

    const keys = Object.keys(rows[0]);
    const sql = `INSERT INTO ${this._table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
    const stmt = db.prepare(sql);

    let lastId: number | bigint = 0;
    const insertMany = db.transaction(() => {
      for (const row of rows) {
        const info = stmt.run(...keys.map((k) => row[k]));
        lastId = info.lastInsertRowid;
      }
    });
    insertMany();

    if (!this._returnRow) return null;

    if (Array.isArray(rawData)) {
      // 挿入した行を一括返却（最後の id から件数分さかのぼる）
      const insertedRows = db
        .prepare(`SELECT * FROM ${this._table} WHERE id > ? ORDER BY id ASC`)
        .all(Number(lastId) - rows.length) as Row[];
      return insertedRows;
    }

    const row = db.prepare(`SELECT * FROM ${this._table} WHERE id = ?`).get(lastId) as Row | undefined;
    return row ?? null;
  }

  private runUpdate(): void {
    const db = getDb();
    const data = this._updateData!;
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const { clause, params } = this.buildWhere();
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const sql = `UPDATE ${this._table} SET ${sets}${clause}`;
    db.prepare(sql).run(...Object.values(data), ...params);
  }

  private runDelete(): void {
    const db = getDb();
    const { clause, params } = this.buildWhere();
    db.prepare(`DELETE FROM ${this._table}${clause}`).run(...params);
  }

  private execute(): Result<Row | Row[] | null> {
    try {
      if (this._op === "select") return { data: this.runSelect(), error: null };
      if (this._op === "insert") return { data: this.runInsert(), error: null };
      if (this._op === "update") { this.runUpdate(); return { data: null, error: null }; }
      if (this._op === "delete") { this.runDelete(); return { data: null, error: null }; }
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  }

  // ─── 終端メソッド ──────────────────────────────────────────────────────────

  single(): Promise<Result<Row | null>> {
    return Promise.resolve((() => {
      try {
        if (this._op === "insert") {
          const row = this.runInsert();
          if (!row) return { data: null, error: new Error("insert returned null") };
          return { data: row, error: null };
        }
        const rows = this.runSelect();
        if (rows.length === 0) return { data: null, error: new Error("row not found") };
        return { data: rows[0], error: null };
      } catch (e) {
        return { data: null, error: e as Error };
      }
    })());
  }

  maybeSingle(): Promise<Result<Row | null>> {
    return Promise.resolve((() => {
      try {
        const rows = this.runSelect();
        return { data: rows[0] ?? null, error: null };
      } catch (e) {
        return { data: null, error: e as Error };
      }
    })());
  }

  // await supabase.from().select().order() のように直接 await できるようにする
  then<T>(
    resolve: (value: Result<Row[]>) => T,
    reject?: (reason: unknown) => T,
  ): Promise<T> {
    try {
      const result = this.execute();
      const value = {
        data: (result.data as Row[] | null) ?? [],
        error: result.error,
      } as Result<Row[]>;
      return Promise.resolve(resolve(value));
    } catch (e) {
      if (reject) return Promise.resolve(reject(e));
      return Promise.reject(e);
    }
  }
}

// ─── supabase 互換エクスポート ────────────────────────────────────────────────

export const supabase = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
};
