import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // リクエストごとに環境変数を読む（モジュールレベルだと起動時評価で .env.local が反映されない場合がある）
  const TOKEN        = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const TEST_USER_ID = process.env.LINE_TEST_USER_ID;

  console.log("[push] token source: LINE_CHANNEL_ACCESS_TOKEN, exists:", !!TOKEN,
    TOKEN ? `length=${TOKEN.length}` : "MISSING");

  if (!TOKEN) {
    return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN が未設定です" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "text が空です" }, { status: 400 });
  }

  // 顧客の line_user_id を優先、未設定時は TEST_USER_ID にフォールバック
  const to = body.to || TEST_USER_ID;
  if (!to) {
    return NextResponse.json({ error: "LINE_USER_ID が未設定です。顧客詳細画面で設定してください。" }, { status: 400 });
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: body.text.trim() }],
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ message: res.statusText }));
    console.error("[push] LINE API 失敗",
      "env_var: LINE_CHANNEL_ACCESS_TOKEN",
      "token_length:", TOKEN.length,
      "status:", res.status,
      "detail:", JSON.stringify(detail));
    return NextResponse.json({ error: detail }, { status: res.status });
  }

  return NextResponse.json({ ok: true, to });
}
