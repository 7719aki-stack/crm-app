import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import type { CustomerRow } from "@/app/customers/dummyData";

// ─── GET /api/customers ────────────────────────────────────
export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from("customers")
      .select("id, name, display_name, category, status, tags, crisis_level, temperature, next_action, total_amount, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const customers: CustomerRow[] = (rows ?? []).map((r) => ({
      id:           r.id,
      name:         r.name,
      display_name: r.display_name ?? r.name,
      category:     (r.category as CustomerRow["category"]) ?? "片思い",
      status:       (r.status   as CustomerRow["status"])   ?? "new_reg",
      tags:         (() => { try { return JSON.parse(r.tags || "[]"); } catch { return []; } })() as string[],
      crisis_level: (Math.min(5, Math.max(1, r.crisis_level ?? 1))) as CustomerRow["crisis_level"],
      temperature:  (r.temperature as CustomerRow["temperature"]) ?? "cool",
      last_contact: r.updated_at ? String(r.updated_at).slice(0, 10) : "",
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

    const { data: row, error } = await supabase
      .from("customers")
      .insert({
        name:         name.trim(),
        display_name: display_name?.trim() || null,
        contact:      contact?.trim()      || null,
        status:       status               || "new_reg",
        tags:         JSON.stringify(tags  || []),
        notes:        notes?.trim()        || null,
      })
      .select()
      .single();

    if (error || !row) throw error ?? new Error("insert returned null");

    return NextResponse.json(
      { ...row, tags: JSON.parse(row.tags) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[POST /api/customers]", e);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
