import { NextRequest, NextResponse } from "next/server";

const TOKEN       = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const TEST_USER_ID = process.env.LINE_TEST_USER_ID;

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: detail }, { status: res.status });
  }

  return NextResponse.json({ ok: true, to });
}
