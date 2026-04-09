import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { CustomerDetail } from "@/app/customers/dummyData";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/customers/[id] ──────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [row] = await sql<{
      id:             number;
      name:           string;
      display_name:   string | null;
      contact:        string | null;
      status:         string;
      tags:           string;
      notes:          string | null;
      line_user_id:   string | null;
      picture_url:    string | null;
      status_message: string | null;
      category:       string;
      crisis_level:   number;
      temperature:    string;
      next_action:    string | null;
      total_amount:   number;
      last_contact:   string;
    }[]>`
      SELECT
        c.*,
        COALESCE(
          (SELECT DATE(m.created_at)
           FROM messages m
           WHERE m.customer_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1),
          DATE(c.updated_at)
        ) AS last_contact
      FROM customers c
      WHERE c.id = ${customerId}
    `;

    if (!row) {
      return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
    }

    const customer: CustomerDetail = {
      id:           row.id,
      name:         row.name,
      display_name: row.display_name ?? row.name,
      contact:      row.contact ?? undefined,
      category:     (row.category as CustomerDetail["category"]) ?? "片思い",
      status:       (row.status   as CustomerDetail["status"])   ?? "new_reg",
      tags:         JSON.parse(row.tags || "[]") as string[],
      crisis_level: (row.crisis_level as CustomerDetail["crisis_level"]) ?? 1,
      temperature:  (row.temperature  as CustomerDetail["temperature"])  ?? "cool",
      last_contact: row.last_contact,
      next_action:  row.next_action,
      total_amount: row.total_amount ?? 0,
      notes:        row.notes        ?? undefined,
      line_user_id: row.line_user_id ?? undefined,
      funnel_stage: 1,
      purchases:    [],
      actions:      [],
      consultation: undefined,
      partner:      undefined,
    };

    return NextResponse.json(customer);
  } catch (e) {
    console.error("[GET /api/customers/[id]]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// ─── PATCH /api/customers/[id] ────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    const allowed = ["status", "tags", "notes", "line_user_id", "category", "crisis_level", "temperature", "next_action"] as const;
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      if (key in body) {
        updates[key] = key === "tags" ? JSON.stringify(body[key]) : body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    updates["updated_at"] = new Date();

    await sql`UPDATE customers SET ${sql(updates)} WHERE id = ${customerId}`;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/customers/[id]]", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
