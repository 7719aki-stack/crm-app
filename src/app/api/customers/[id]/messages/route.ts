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
  const debug: boolean = body.debug === true;

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "text is too long" }, { status: 400 });
  }

  const log = (...args: unknown[]) => {
    if (debug) console.log("[LINE DEBUG]", ...args);
  };

  log("customerId:", customerId);

  // 1. 顧客の line_user_id を取得
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("line_user_id")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    console.error("[POST messages] 顧客取得失敗 customerId:", customerId, customerError);
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  const lineUserId: string = customer.line_user_id ?? "";
  if (!lineUserId) {
    return NextResponse.json(
      { error: "LINE IDが設定されていません。顧客詳細でLINE IDを登録してください。" },
      { status: 400 }
    );
  }

  // to が string かつ空文字でないことを確認
  if (typeof lineUserId !== "string" || lineUserId.trim() === "") {
    console.error("[POST messages] line_user_id が無効 customerId:", customerId, "value:", lineUserId);
    return NextResponse.json({ error: "line_user_id が無効です" }, { status: 400 });
  }

  const maskedId =
    lineUserId.length > 10
      ? `${lineUserId.slice(0, 5)}...${lineUserId.slice(-5)}`
      : `${lineUserId.slice(0, 2)}***`;
  log("line_user_id (masked):", maskedId);

  // 2. LINE Messaging API でメッセージ送信
  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  log("token source: LINE_CHANNEL_ACCESS_TOKEN, exists:", !!TOKEN,
    TOKEN ? `length=${TOKEN.length}` : "MISSING");

  if (!TOKEN) {
    console.error("[POST messages] LINE_CHANNEL_ACCESS_TOKEN が未設定");
    return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN が未設定です" }, { status: 500 });
  }

  const payload = {
    to:       lineUserId,
    messages: [{ type: "text", text }],
  };
  log("送信 payload:", JSON.stringify(payload));

  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const lineResText = await lineRes.text().catch(() => lineRes.statusText);
  log("LINE API status:", lineRes.status);
  log("LINE API body:", lineResText);

  if (!lineRes.ok) {
    console.error(
      "[POST messages] LINE送信失敗",
      "env_var: LINE_CHANNEL_ACCESS_TOKEN",
      "token_length:", TOKEN.length,
      "customerId:", customerId,
      "masked_id:", maskedId,
      "status:", lineRes.status,
      "body:", lineResText
    );
    return NextResponse.json(
      { error: "LINE送信に失敗しました", detail: lineResText },
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
      })
      .select("id, customer_id, source, direction, text, raw_type, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    console.error("[POST messages] DB保存失敗 customerId:", customerId, e);
    return NextResponse.json(
      { error: "LINE送信は成功しましたが、履歴保存に失敗しました" },
      { status: 500 }
    );
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
