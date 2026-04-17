/**
 * ab_results テーブルを Supabase に作成するマイグレーションスクリプト
 * 使い方: node scripts/migrate-ab-results.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.nswsjdlkcanjycmpzmwd:771977aki1110@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  console.log("DB 接続成功");

  await client.query(`
    CREATE TABLE IF NOT EXISTS ab_results (
      id             SERIAL PRIMARY KEY,
      winner         TEXT NOT NULL,               -- "A" or "B"
      decided_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      click_count_a  INTEGER NOT NULL DEFAULT 0,
      click_count_b  INTEGER NOT NULL DEFAULT 0,
      cvr_a          REAL    NOT NULL DEFAULT 0,
      cvr_b          REAL    NOT NULL DEFAULT 0,
      is_current     BOOLEAN NOT NULL DEFAULT true  -- 最新の結果かどうか
    );
  `);
  console.log("ab_results テーブル作成 OK");

  // is_current が true のレコードを最大1件に保つ関数的インデックス
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ab_results_current
    ON ab_results (is_current)
    WHERE is_current = true;
  `);
  console.log("インデックス作成 OK");

  await client.end();
  console.log("\n✅ マイグレーション完了");
})().catch((e) => {
  console.error("マイグレーション失敗:", e.message);
  process.exit(1);
});
