import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
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
    const { data: row, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
    }

    // last_contact: 最新メッセージ日 or updated_at
    const { data: lastMsg } = (await supabase
      .from("messages")
      .select("created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as unknown as { data: { created_at: string | null } | null };

    const lastContact = lastMsg?.created_at
      ? String(lastMsg.created_at).slice(0, 10)
      : String(row.updated_at).slice(0, 10);

    // 購入履歴を appraisals テーブルから取得
    const { data: appraisalRows } = await supabase
      .from("appraisals")
      .select("id, type, price, paid, notes, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    const purchases = (appraisalRows ?? []).map((a) => ({
      id:         a.id,
      date:       String(a.created_at).slice(0, 10),
      product_id: a.type as import("@/lib/products").ProductId,
      note:       (a.notes as string | null) ?? undefined,
      price:      a.price ?? 0,
      paid:       a.paid === 1,
    }));

    const customer: CustomerDetail = {
      id:           row.id,
      name:         row.name,
      display_name: row.display_name ?? row.name,
      contact:      row.contact      ?? undefined,
      category:     (row.category as CustomerDetail["category"]) ?? "片思い",
      status:       (row.status   as CustomerDetail["status"])   ?? "new_reg",
      tags:         (() => { try { return JSON.parse(row.tags || "[]"); } catch { return []; } })() as string[],
      crisis_level: (row.crisis_level as CustomerDetail["crisis_level"]) ?? 1,
      temperature:  (row.temperature  as CustomerDetail["temperature"])  ?? "cool",
      last_contact: lastContact,
      next_action:  row.next_action   ?? null,
      total_amount: row.total_amount  ?? 0,
      notes:        row.notes         ?? undefined,
      line_user_id: row.line_user_id  ?? undefined,
      funnel_stage: 1,
      purchases,
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

    const allowed = ["name", "display_name", "status", "tags", "notes", "line_user_id", "category", "crisis_level", "temperature", "next_action"] as const;
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      if (key in body) {
        updates[key] = key === "tags" ? JSON.stringify(body[key]) : body[key];
      }
    }

    if ("name" in updates) {
      const n = typeof updates["name"] === "string" ? updates["name"].trim() : "";
      if (!n || n.length < 2 || !/[a-zA-Z0-9\u3040-\u9fff\uff00-\uffef]/.test(n)) {
        return NextResponse.json({ error: "名前が無効です（2文字以上、日本語・英数字を含めてください）" }, { status: 400 });
      }
      updates["name"] = n;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    updates["updated_at"] = new Date().toISOString();

    const { error } = await supabase
      .from("customers")
      .update(updates as unknown as never)
      .eq("id", customerId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/customers/[id]]", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

// ─── DELETE /api/customers/[id] ───────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await supabase.from("scenario_schedules").delete().eq("customer_id", customerId);
    await supabase.from("appraisals").delete().eq("customer_id", customerId);
    await supabase.from("messages").delete().eq("customer_id", customerId);
    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/customers/[id]]", e);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
