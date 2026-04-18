import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function tokenFingerprint(token: string | undefined): string {
  if (!token) return "(未設定)";
  if (token.length < 12) return "(短すぎる)";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

// GET /api/line-debug-push
// customers.id=1 の line_user_id に「テスト送信です」を1通 push する
export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  // 顧客ID=1 の line_user_id を取得
  const { data: customer, error: dbError } = await supabase
    .from("customers")
    .select("id, line_user_id")
    .eq("id", 1)
    .single();

  if (dbError || !customer) {
    return NextResponse.json({
      ok: false,
      step: "db_lookup",
      error: dbError?.message ?? "customers.id=1 が見つかりません",
      tokenFingerprint: tokenFingerprint(token),
    }, { status: 500 });
  }

  const lineUserId = customer.line_user_id as string | null;

  if (!lineUserId) {
    return NextResponse.json({
      ok: false,
      step: "check_line_user_id",
      error: "customers.id=1 に line_user_id が設定されていません",
      customerId: 1,
      tokenFingerprint: tokenFingerprint(token),
    }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({
      ok: false,
      step: "check_token",
      error: "LINE_CHANNEL_ACCESS_TOKEN が未設定です",
      targetUserId: lineUserId,
      apiUrl: LINE_PUSH_URL,
    }, { status: 500 });
  }

  // LINE Push 送信
  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: "テスト送信です" }],
    }),
  });

  const responseText = await res.text();
  let responseBody: unknown;
  try { responseBody = JSON.parse(responseText); } catch { responseBody = responseText; }

  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      step: "line_api",
      httpStatus: res.status,
      lineApiResponse: responseBody,
      targetUserId: lineUserId,
      apiUrl: LINE_PUSH_URL,
      tokenFingerprint: tokenFingerprint(token),
    }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    message: "テスト送信成功",
    targetUserId: lineUserId,
    apiUrl: LINE_PUSH_URL,
    tokenFingerprint: tokenFingerprint(token),
    lineApiResponse: responseBody,
  });
}
