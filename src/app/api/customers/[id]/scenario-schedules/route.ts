import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerScenarioSchedules,
  createEducationSchedules,
} from "@/lib/educationScenario";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/customers/[id]/scenario-schedules ────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const schedules = await getCustomerScenarioSchedules(customerId);
    return NextResponse.json(schedules);
  } catch (e) {
    console.error("[GET /api/customers/[id]/scenario-schedules]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// ─── POST /api/customers/[id]/scenario-schedules ───────────
// 教育シナリオのスケジュールを生成する。重複時は空配列を返す（200）。
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({})) as { base_date?: string };
    const baseDate = body.base_date ? new Date(body.base_date) : new Date();

    const created = await createEducationSchedules(customerId, baseDate);
    return NextResponse.json(created, { status: created.length > 0 ? 201 : 200 });
  } catch (e) {
    console.error("[POST /api/customers/[id]/scenario-schedules]", e);
    return NextResponse.json({ error: "スケジュール生成に失敗しました" }, { status: 500 });
  }
}
