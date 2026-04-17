// ── ab_results テーブルに revenue_per_click カラムを追加するマイグレーション
// 実行: node scripts/migrate-ab-results-revenue.mjs
//
// Supabase SQL（手動実行版）:
// ALTER TABLE ab_results
//   ADD COLUMN IF NOT EXISTS revenue_per_click_a FLOAT DEFAULT 0,
//   ADD COLUMN IF NOT EXISTS revenue_per_click_b FLOAT DEFAULT 0;

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function main() {
  console.log("Checking ab_results schema...");

  // カラムが既に存在するか確認（1行取得して確認）
  const { data, error } = await supabase
    .from("ab_results")
    .select("revenue_per_click_a, revenue_per_click_b")
    .limit(1);

  if (!error) {
    console.log("✓ revenue_per_click_a/b カラムは既に存在します");
    return;
  }

  console.log("カラムが存在しません。Supabase Dashboard の SQL Editor で以下を実行してください:");
  console.log("");
  console.log("ALTER TABLE ab_results");
  console.log("  ADD COLUMN IF NOT EXISTS revenue_per_click_a FLOAT DEFAULT 0,");
  console.log("  ADD COLUMN IF NOT EXISTS revenue_per_click_b FLOAT DEFAULT 0;");
  console.log("");
  console.log("または Supabase Service Role Key を使用して RPC で実行してください。");
}

main().catch(console.error);
