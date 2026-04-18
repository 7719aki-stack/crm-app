import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createEducationSchedules } from "@/lib/educationScenario";
import type { CustomerRow } from "@/app/customers/dummyData";

// ─── GET /api/customers ────────────────────────────────────
export async function GET() {
  try {
    // 顧客一覧
    const { data: rows, error } = await supabase
      .from("customers")
      .select("id, name, display_name, category, status, tags, crisis_level, temperature, next_action, total_amount, updated_at, created_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // 支払済み appraisals から顧客別の最終購入日・件数を集計
    const { data: appraisalRows } = await supabase
      .from("appraisals")
      .select("customer_id, price, created_at")
      .eq("paid", 1)
      .order("created_at", { ascending: false });

    // customer_id → { last_purchase_date, count, total }
    type PurchaseInfo = { last_purchase_date: string; purchase_count: number; total_amount: number };
    const purchaseMap = new Map<number, PurchaseInfo>();
    for (const a of appraisalRows ?? []) {
      const prev = purchaseMap.get(a.customer_id);
      if (!prev) {
        purchaseMap.set(a.customer_id, {
          last_purchase_date: String(a.created_at).slice(0, 10),
          purchase_count:     1,
          total_amount:       a.price ?? 0,
        });
      } else {
        purchaseMap.set(a.customer_id, {
          last_purchase_date: prev.last_purchase_date, // 降順なので最初が最新
          purchase_count:     prev.purchase_count + 1,
          total_amount:       prev.total_amount + (a.price ?? 0),
        });
      }
    }

    const customers: CustomerRow[] = (rows ?? []).map((r) => {
      const pInfo = purchaseMap.get(r.id);
      return {
        id:                  r.id,
        name:                r.name,
        display_name:        r.display_name ?? r.name,
        category:            (r.category as CustomerRow["category"]) ?? "片思い",
        status:              (r.status   as CustomerRow["status"])   ?? "new_reg",
        tags:                (() => { try { return JSON.parse(r.tags || "[]"); } catch { return []; } })() as string[],
        crisis_level:        (Math.min(5, Math.max(1, r.crisis_level ?? 1))) as CustomerRow["crisis_level"],
        temperature:         (r.temperature as CustomerRow["temperature"]) ?? "cool",
        last_contact:        r.updated_at ? String(r.updated_at).slice(0, 10) : "",
        next_action:         r.next_action,
        // appraisals から集計した値を優先し、なければ customers.total_amount
        total_amount:        pInfo?.total_amount ?? r.total_amount ?? 0,
        created_at:          r.created_at ? String(r.created_at).slice(0, 10) : "",
        last_purchase_date:  pInfo?.last_purchase_date ?? null,
        purchase_count:      pInfo?.purchase_count ?? 0,
      };
    });

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

    // 顧客作成時に教育シナリオを自動生成（失敗しても顧客作成は成功扱い）
    createEducationSchedules(row.id).catch((e) =>
      console.warn("[POST /api/customers] 教育シナリオ生成失敗:", e),
    );

    return NextResponse.json(
      { ...row, tags: JSON.parse(row.tags) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[POST /api/customers]", e);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
