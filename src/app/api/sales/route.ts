import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export interface SaleRow {
  id:            number;
  customer_id:   number;
  customer_name: string;
  type:          string;
  price:         number;
  paid:          number;
  notes:         string | null;
  created_at:    string;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        a.id,
        a.customer_id,
        COALESCE(c.name, '不明') AS customer_name,
        a.type,
        a.price,
        a.paid,
        a.notes,
        a.created_at
      FROM appraisals a
      LEFT JOIN customers c ON a.customer_id = c.id
      ORDER BY a.created_at DESC
    `).all() as SaleRow[];

    return NextResponse.json(rows);
  } catch (e) {
    console.error("[GET /api/sales]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
