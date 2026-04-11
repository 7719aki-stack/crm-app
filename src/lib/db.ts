import { createClient } from "@supabase/supabase-js";

// サーバーレス環境でのホットリロード対策：グローバルシングルトン
const g = globalThis as unknown as { _supabase?: ReturnType<typeof createClient> };

if (!g._supabase) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url) throw new Error("SUPABASE_URL が設定されていません");
  if (!key) throw new Error("SUPABASE_ANON_KEY が設定されていません");
  g._supabase = createClient(url, key);
}

export const supabase = g._supabase!;
