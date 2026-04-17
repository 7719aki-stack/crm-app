// ─── 教育シナリオ管理（サーバーサイド専用）────────────────────────────────
// DB (Supabase) の scenario_schedules テーブルを使って
// 顧客ごとの教育シナリオ送信予定を管理する。
// このファイルは API Route / Server Component からのみインポートすること。

import { supabase as defaultDb } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 型定義 ────────────────────────────────────────────────

export type ScenarioScheduleStatus = "pending" | "sent" | "cancelled";

export interface ScenarioSchedule {
  id:            number;
  customer_id:   number;
  scenario_type: string;
  step_no:       number;
  scheduled_at:  string;   // ISO datetime
  status:        ScenarioScheduleStatus;
  message_body:  string;
  sent_at:       string | null;
  created_at:    string;
  updated_at:    string;
}

// ─── 教育シナリオ定義 ───────────────────────────────────────

export const EDUCATION_SCENARIO_TYPE = "education" as const;

interface EducationStep {
  step_no:      number;
  delay_days:   number;   // 初回起点からの遅延日数
  message_body: string;
}

export const EDUCATION_STEPS: EducationStep[] = [
  {
    step_no:    1,
    delay_days: 1,
    message_body:
      "この度はご登録いただきありがとうございます。\n\nルナジェミニアでは、恋愛・人生のお悩みに星と霊感の力で丁寧に向き合っております。\n\nまずはどんな小さなことでも、気になることをお気軽にお話しください。あなたのペースで大丈夫です。",
  },
  {
    step_no:    2,
    delay_days: 3,
    message_body:
      "その後、お気持ちはいかがでしょうか？\n\n鑑定では、相手の方の今の気持ちや今後の流れを詳しく視ることができます。「なぜこうなったのか」「これからどう動けばよいのか」が明確になることで、多くの方が前向きに行動できるようになっています。\n\n気になることがあれば、いつでもお声がけください。",
  },
  {
    step_no:    3,
    delay_days: 7,
    message_body:
      "こんにちは。その後のご状況はいかがでしょうか？\n\nタイミングを逃すと状況が変わってしまうこともあります。今の気持ちや状況を一度整理して、最初の一歩を踏み出しませんか？\n\n鑑定は初回のご相談から始められます。いつでもお気軽にご連絡ください。",
  },
];

// ─── スケジュール生成 ──────────────────────────────────────

/**
 * 顧客に教育シナリオのスケジュールを登録する。
 * 同一 customer_id / scenario_type の pending または sent が既にある場合は重複作成しない。
 * @param customerId 対象顧客 ID
 * @param baseDate   起点日時（省略時: 現在時刻）
 * @param db         DB クライアント（テスト時はモックを渡す）
 * @returns 作成されたスケジュール一覧（重複時は空配列）
 */
export async function createEducationSchedules(
  customerId: number,
  baseDate: Date = new Date(),
  db: SupabaseClient = defaultDb,
): Promise<ScenarioSchedule[]> {
  // 重複チェック: pending または sent が存在するかを確認
  const { data: existing } = await db
    .from("scenario_schedules")
    .select("id")
    .eq("customer_id", customerId)
    .eq("scenario_type", EDUCATION_SCENARIO_TYPE)
    .in("status", ["pending", "sent"])
    .limit(1);

  if (existing && existing.length > 0) return [];

  const inserts = EDUCATION_STEPS.map((step) => ({
    customer_id:   customerId,
    scenario_type: EDUCATION_SCENARIO_TYPE,
    step_no:       step.step_no,
    scheduled_at:  new Date(
      baseDate.getTime() + step.delay_days * 24 * 60 * 60 * 1000,
    ).toISOString(),
    status:        "pending" as const,
    message_body:  step.message_body,
    sent_at:       null,
  }));

  const { data, error } = await db
    .from("scenario_schedules")
    .insert(inserts)
    .select();

  if (error) throw error;
  return (data ?? []) as ScenarioSchedule[];
}

// ─── 一覧取得 ──────────────────────────────────────────────

/**
 * 顧客のシナリオスケジュール一覧を scheduled_at 昇順で返す。
 */
export async function getCustomerScenarioSchedules(
  customerId: number,
  db: SupabaseClient = defaultDb,
): Promise<ScenarioSchedule[]> {
  const { data, error } = await db
    .from("scenario_schedules")
    .select("*")
    .eq("customer_id", customerId)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScenarioSchedule[];
}

// ─── Due スケジュール取得 ──────────────────────────────────

/**
 * 送信期限が来ている pending スケジュールを全件返す。
 * 二重送信防止のため status を確認してから処理すること。
 */
export async function getDueSchedules(
  now: Date = new Date(),
  db: SupabaseClient = defaultDb,
): Promise<ScenarioSchedule[]> {
  const { data, error } = await db
    .from("scenario_schedules")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScenarioSchedule[];
}

// ─── ステータス更新 ────────────────────────────────────────

/**
 * スケジュールを送信済みにする（sent + sent_at を更新）。
 * 二重送信防止: pending でない場合は更新せずに false を返す。
 */
export async function markScheduleSent(
  id: number,
  db: SupabaseClient = defaultDb,
): Promise<boolean> {
  const { data: current } = await db
    .from("scenario_schedules")
    .select("status")
    .eq("id", id)
    .single();

  if (!current || current.status !== "pending") return false;

  const { error } = await db
    .from("scenario_schedules")
    .update({
      status:     "sent",
      sent_at:    new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending"); // 競合防止

  if (error) throw error;
  return true;
}

/**
 * スケジュールをキャンセルする。
 */
export async function cancelSchedule(
  id: number,
  db: SupabaseClient = defaultDb,
): Promise<void> {
  const { error } = await db
    .from("scenario_schedules")
    .update({
      status:     "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}
