import { NextResponse } from "next/server";
import { getDueSchedules, markScheduleSent } from "@/lib/educationScenario";

// ─── POST /api/scenario-schedules/process ─────────────────
// 送信期限が来ている pending スケジュールを処理する。
// 定期実行（cron）またはテスト用途で呼び出す。
//
// 実際の LINE 送信は line_user_id が必要なため、
// ここでは sent 更新のみ行い、送信ログを返す。
// 本番運用では supabase から line_user_id を引いて LINE API へ送信する。
export async function POST() {
  try {
    const due = await getDueSchedules();

    const results: { id: number; customer_id: number; step_no: number; ok: boolean; reason?: string }[] = [];

    for (const schedule of due) {
      try {
        const updated = await markScheduleSent(schedule.id);
        results.push({
          id:          schedule.id,
          customer_id: schedule.customer_id,
          step_no:     schedule.step_no,
          ok:          updated,
          reason:      updated ? undefined : "already_processed",
        });
      } catch (e) {
        results.push({
          id:          schedule.id,
          customer_id: schedule.customer_id,
          step_no:     schedule.step_no,
          ok:          false,
          reason:      String(e),
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ processed: results.length, sent: successCount, results });
  } catch (e) {
    console.error("[POST /api/scenario-schedules/process]", e);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
