// GET /api/ab-winner
// 1. ログから ABResult をリアルタイム計算
// 2. 勝者が決まっていれば DB に保存（is_current=true）
// 3. DB の最新勝者レコードも一緒に返す
//
// クライアント（reminder.ts）はこの API をポーリングして
// variant をリアルタイムに切り替える。

import { NextResponse } from "next/server";
import {
  getABResult,
  saveABResultToDB,
  loadABResultFromDB,
  detectABAnomaly,
  MIN_CLICKS_FOR_DECISION,
} from "@/lib/abTest";

export async function GET() {
  try {
    // ── 1. ログから常に再計算（キャッシュなし）───────────────
    const live = getABResult();

    // ── 2. 勝者確定なら DB に永続化 ──────────────────────────
    if (live.winner) {
      await saveABResultToDB(live);
    }

    // ── 3. DB の最新勝者を取得（永続化されたもの）────────────
    const stored = await loadABResultFromDB();

    // ── 4. 異常検知 ───────────────────────────────────────────
    const anomalies = detectABAnomaly(live);

    // ── 5. 実際に使う winner の優先順位 ──────────────────────
    // ライブ計算が優先（データが蓄積している場合）
    // ライブに勝者なし → DB の永続化済み勝者を使う
    const effectiveWinner = live.winner ?? stored?.winner ?? null;

    return NextResponse.json({
      // リアルタイム計算
      live: {
        winner:         live.winner,
        A:              live.A,
        B:              live.B,
        totalClicks:    live.totalClicks,
        totalPurchases: live.totalPurchases,
        overallCVR:     live.overallCVR,
      },
      // DB 永続化済み
      stored: stored
        ? {
            winner:       stored.winner,
            decided_at:   stored.decided_at,
            click_count_a: stored.click_count_a,
            click_count_b: stored.click_count_b,
            cvr_a:         stored.cvr_a,
            cvr_b:         stored.cvr_b,
          }
        : null,
      // クライアントが使うべき勝者（ライブ優先 → DB フォールバック）
      winner:            effectiveWinner,
      minClicksRequired: MIN_CLICKS_FOR_DECISION,
      anomalies,
    });
  } catch (e) {
    console.error("[GET /api/ab-winner]", e);
    return NextResponse.json({ winner: null, error: "解析失敗" }, { status: 500 });
  }
}
