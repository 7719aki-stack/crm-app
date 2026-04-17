// POST /api/appraisals  – 購入記録を新規作成
// GET  /api/appraisals  – 全件取得
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { syncCustomerTotalAmount } from "@/lib/getSalesSummary";
import { getLastClickVariant, logPurchaseEvent } from "@/lib/abTest";

// ── GET ────────────────────────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("appraisals")
      .select("id, customer_id, type, price, paid, notes, created_at, customers(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error("[GET /api/appraisals]", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────
// body: { customer_id, type, price, paid?, notes? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      customer_id: number;
      type:        string;
      price:       number;
      paid?:       number; // 0 or 1
      notes?:      string;
    };

    const { customer_id, type, price, paid = 0, notes } = body;

    if (!customer_id || !type || price == null) {
      return NextResponse.json(
        { error: "customer_id, type, price は必須です" },
        { status: 400 },
      );
    }

    const { data: row, error } = await supabase
      .from("appraisals")
      .insert({
        customer_id,
        type,
        price:  Number(price),
        paid:   paid === 1 ? 1 : 0,
        notes:  notes ?? null,
        status: "受付中",
      })
      .select()
      .single();

    if (error || !row) throw error ?? new Error("insert returned null");

    // paid=1 で作成された場合は total_amount 同期 + AB purchase ログ
    if (paid === 1) {
      await syncCustomerTotalAmount(customer_id);
      const variant = getLastClickVariant(customer_id);
      if (variant) logPurchaseEvent(customer_id, variant, Number(price));
    }

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error("[POST /api/appraisals]", e);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
