import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export interface DbMessage {
  id:          number;
  customer_id: number;
  source:      string;
  direction:   "inbound" | "outbound";
  text:        string;
  raw_type:    string | null;
  created_at:  string;
}

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/customers/[id]/messages ─────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const rows = await sql<DbMessage[]>`
      SELECT id, customer_id, source, direction, text, raw_type, created_at
      FROM messages
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return NextResponse.json(rows);
  } catch (e) {
    console.error("[GET /api/customers/[id]/messages]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
