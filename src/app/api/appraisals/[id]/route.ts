// PATCH /api/appraisals/[id]  – 支払い状態・メモ等を更新
// paid を 0→1 に変えた際は customers.total_amount を自動同期する
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { syncCustomerTotalAmount } from "@/lib/getSalesSummary";
import { getLastClickVariant, logPurchaseEvent } from "@/lib/abTest";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const appraisalId = Number(id);
  if (isNaN(appraisalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    const allowed = ["paid", "notes", "delivered_at", "price", "type", "status"] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    // 更新前に customer_id を取得
    const { data: current, error: fetchErr } = await supabase
      .from("appraisals")
      .select("customer_id, paid")
      .eq("id", appraisalId)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "鑑定が見つかりません" }, { status: 404 });
    }

    const { error } = await supabase
      .from("appraisals")
      .update(updates as never)
      .eq("id", appraisalId);

    if (error) throw error;

    // paid が変化した（または price が変化した）場合は total_amount を再計算
    const paidChanged  = "paid" in body;
    const priceChanged = "price" in body;
    if (paidChanged || priceChanged) {
      await syncCustomerTotalAmount(current.customer_id);
    }

    // paid が 0→1 に変化した場合は AB purchase ログを記録
    if (paidChanged && body.paid === 1 && current.paid !== 1) {
      // 最新の price を取得してログに記録
      const { data: updated } = await supabase
        .from("appraisals")
        .select("price")
        .eq("id", appraisalId)
        .single();
      const price   = Number(updated?.price ?? body.price ?? 0);
      const variant = getLastClickVariant(current.customer_id);
      if (variant) logPurchaseEvent(current.customer_id, variant, price);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/appraisals/[id]]", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const appraisalId = Number(id);
  if (isNaN(appraisalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // 削除前に customer_id を取得
    const { data: current } = await supabase
      .from("appraisals")
      .select("customer_id")
      .eq("id", appraisalId)
      .single();

    const { error } = await supabase
      .from("appraisals")
      .delete()
      .eq("id", appraisalId);

    if (error) throw error;

    // total_amount を再計算
    if (current?.customer_id) {
      await syncCustomerTotalAmount(current.customer_id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/appraisals/[id]]", e);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
