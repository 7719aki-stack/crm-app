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

// ─── POST /api/customers/[id]/messages ────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // 1. 顧客の line_user_id を取得
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("line_user_id")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  if (!customer.line_user_id) {
    return NextResponse.json(
      { error: "LINE IDが設定されていません。顧客詳細でLINE IDを登録してください。" },
      { status: 400 }
    );
  }

  // 2. LINE Messaging API でメッセージ送信
  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!TOKEN) {
    return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN が未設定です" }, { status: 500 });
  }

  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to:       customer.line_user_id,
      messages: [{ type: "text", text }],
    }),
  });

  if (!lineRes.ok) {
    const detail = await lineRes.json().catch(() => ({ message: lineRes.statusText }));
    console.error("[POST /api/customers/[id]/messages] LINE送信失敗", detail);
    return NextResponse.json(
      { error: "LINE送信に失敗しました", detail },
      { status: lineRes.status }
    );
  }

  // 3. LINE送信成功時のみ messages に保存
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        customer_id: customerId,
        source:      "manual",
        direction:   "outbound",
        text,
        created_at:  new Date().toISOString(),
      })
      .select("id, customer_id, source, direction, text, raw_type, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    console.error("[POST /api/customers/[id]/messages]", e);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

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
