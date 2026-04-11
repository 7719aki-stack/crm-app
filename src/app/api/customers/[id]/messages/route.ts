import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

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
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, customer_id, source, direction, text, raw_type, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return NextResponse.json(rows ?? []);
  } catch (e) {
    console.error("[GET /api/customers/[id]/messages]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
