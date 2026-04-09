import postgres from "postgres";

// サーバーレス環境でのホットリロード対策：グローバルシングルトン
const g = globalThis as unknown as { _pgSql?: ReturnType<typeof postgres> };

if (!g._pgSql) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません");
  g._pgSql = postgres(url, {
    ssl: "require",
    max: 1,           // サーバーレス：接続数を最小限に
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const sql = g._pgSql;
