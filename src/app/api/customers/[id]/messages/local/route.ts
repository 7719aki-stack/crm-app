// POST /api/customers/[id]/messages/local
// LINE API を呼ばずに messages テーブルに outbound 記録を保存する。
// body: { text: string; next_action?: string; source?: string }
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import type { DbMessage } from "@/app/api/customers/[id]/messages/route";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const text: string        = typeof body.text        === "string" ? body.text.trim()        : "";
  const next_action: string = typeof body.next_action === "string" ? body.next_action.trim() : "";
  const source: string      = typeof body.source      === "string" ? body.source             : "manual";

  if (!text) {
    return NextResponse.json({ error: "text は必須です" }, { status: 400 });
  }

  try {
    // messages テーブルに outbound レコードを挿入
    const { data, error } = await supabase
      .from("messages")
      .insert({
        customer_id: customerId,
        source,
        direction:   "outbound",
        text,
      })
      .select("id, customer_id, source, direction, text, raw_type, created_at")
      .single();

    if (error || !data) throw error ?? new Error("insert failed");

    // next_action が指定されていれば customers を更新
    if (next_action) {
      await supabase
        .from("customers")
        .update({ next_action, updated_at: new Date().toISOString() })
        .eq("id", customerId);
    }

    return NextResponse.json(data as DbMessage, { status: 201 });
  } catch (e) {
    console.error("[POST /api/customers/[id]/messages/local]", e);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
