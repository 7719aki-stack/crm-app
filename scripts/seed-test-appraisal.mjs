/**
 * テスト用購入データ投入スクリプト
 * 使い方: node scripts/seed-test-appraisal.mjs
 *
 * 実行すると:
 *  - DB の最初の顧客に「深層恋愛鑑定 ¥5,000 / paid=1」を1件追加
 *  - その顧客の total_amount を同期
 */

const SUPABASE_URL     = "https://nswsjdlkcanjycmpzmwd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zd3NqZGxrY2FuanljbXB6bXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTU0ODksImV4cCI6MjA5MTI5MTQ4OX0.qUh8Bq-fK5Dt0OGy_tYWXB6_phQ6heG8NM7jC9zJE44";

const headers = {
  "Content-Type":  "application/json",
  "apikey":        SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Prefer":        "return=representation",
};

async function rpc(path, method = "GET", body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. 最初の顧客を取得
  const customers = await rpc("customers?select=id,name&order=id.asc&limit=1");
  if (!customers || customers.length === 0) {
    console.error("顧客が存在しません。先に顧客を登録してください。");
    process.exit(1);
  }
  const customer = customers[0];
  console.log(`顧客: ${customer.name} (id=${customer.id})`);

  // 2. 今日の日付で appraisal を挿入
  const today = new Date().toISOString();
  const [appraisal] = await rpc("appraisals", "POST", {
    customer_id: customer.id,
    type:        "other",        // 深層恋愛鑑定
    price:       5000,
    paid:        1,
    notes:       "[テストデータ] 深層恋愛鑑定",
    status:      "受付中",
    created_at:  today,
  });
  console.log(`appraisal 作成: id=${appraisal.id}, paid=${appraisal.paid}, price=${appraisal.price}`);

  // 3. customers.total_amount を更新
  //    paid=1 の appraisals を合算
  const paidAppraisals = await rpc(
    `appraisals?select=price&customer_id=eq.${customer.id}&paid=eq.1`
  );
  const total = paidAppraisals.reduce((s, a) => s + (a.price ?? 0), 0);
  await rpc(`customers?id=eq.${customer.id}`, "PATCH", { total_amount: total });
  console.log(`customers.total_amount 更新: ${total}円`);

  console.log("\n✅ テストデータ投入完了");
  console.log("   ダッシュボード今月売上  = ¥5,000");
  console.log(`   顧客「${customer.name}」= 購入済 / ¥5,000`);
  console.log("   売上管理              = ¥5,000");
})();
