import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { CustomerRow } from "@/app/customers/dummyData";

// ─── GET /api/customers ────────────────────────────────────
export async function GET() {
  try {
    const rows = await sql<{
      id:           number;
      name:         string;
      display_name: string | null;
      category:     string;
      status:       string;
      tags:         string;
      crisis_level: number;
      temperature:  string;
      next_action:  string | null;
      total_amount: number;
      last_contact: string;
    }[]>`
      SELECT
        c.id,
        c.name,
        COALESCE(c.display_name, c.name) AS display_name,
        c.category,
        c.status,
        c.tags,
        c.crisis_level,
        c.temperature,
        c.next_action,
        c.total_amount,
        COALESCE(
          (SELECT DATE(m.created_at)
           FROM messages m
           WHERE m.customer_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1),
          DATE(c.updated_at)
        ) AS last_contact
      FROM customers c
      ORDER BY last_contact DESC
    `;

    const customers: CustomerRow[] = rows.map((r) => ({
      id:           r.id,
      name:         r.name,
      display_name: r.display_name ?? r.name,
      category:     (r.category as CustomerRow["category"]) ?? "片思い",
      status:       (r.status   as CustomerRow["status"])   ?? "new_reg",
      tags:         JSON.parse(r.tags || "[]") as string[],
      crisis_level: (r.crisis_level as CustomerRow["crisis_level"]) ?? 1,
      temperature:  (r.temperature as CustomerRow["temperature"]) ?? "cool",
      last_contact: r.last_contact,
      next_action:  r.next_action,
      total_amount: r.total_amount ?? 0,
    }));

    return NextResponse.json(customers);
  } catch (e) {
    console.error("[GET /api/customers]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// ─── POST /api/customers ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, display_name, contact, status, tags, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO customers (name, display_name, contact, status, tags, notes)
      VALUES (
        ${name.trim()},
        ${display_name?.trim() || null},
        ${contact?.trim()      || null},
        ${status               || "new_reg"},
        ${JSON.stringify(tags  || [])},
        ${notes?.trim()        || null}
      )
      RETURNING *
    `;

    return NextResponse.json(
      { ...row, tags: JSON.parse(row.tags) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[POST /api/customers]", e);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
