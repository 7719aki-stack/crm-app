import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // ボディが空でも LINE は 200 を期待するため正常応答
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const events = (body as { events?: unknown[] })?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  for (const event of events) {
    const ev = event as Record<string, unknown>;

    // message イベントかつテキストのみ処理
    if (ev.type !== "message") continue;
    const msg = ev.message as Record<string, unknown> | undefined;
    if (!msg || msg.type !== "text") continue;

    const lineUserId = (ev.source as Record<string, unknown> | undefined)?.userId as string | undefined;
    const text       = (msg.text as string | undefined) ?? "";

    if (!lineUserId) {
      console.error("[webhook] lineUserId is missing in event", ev);
      continue;
    }

    try {
      // customers upsert（存在しなければ新規作成、name は NOT NULL なので line_user_id を仮置き）
      const customerPayload = { line_user_id: lineUserId, name: lineUserId };
      console.log("[webhook] customer upsert payload", customerPayload);
      await sql`
        INSERT INTO customers (line_user_id, name, created_at, updated_at)
        VALUES (${lineUserId}, ${lineUserId}, NOW(), NOW())
        ON CONFLICT (line_user_id) DO UPDATE SET updated_at = NOW()
      `;

      // customers.id を取得
      const rows = await sql<{ id: number }[]>`
        SELECT id FROM customers WHERE line_user_id = ${lineUserId} LIMIT 1
      `;
      const customerId = rows[0]?.id;

      if (customerId == null) {
        console.error("[webhook] customerId not found after upsert", { lineUserId });
        continue;
      }

      // messages 保存（schema.sql に従い topic カラムなし・source/direction/text は NOT NULL）
      const messagePayload = { customer_id: customerId, source: "line", direction: "inbound", text };
      console.log("[webhook] message insert payload", messagePayload);
      await sql`
        INSERT INTO messages (customer_id, source, direction, text, created_at)
        VALUES (${customerId}, ${"line"}, ${"inbound"}, ${text}, NOW())
      `;
    } catch (err) {
      console.error("[webhook] DB error", JSON.stringify({
        lineUserId,
        text,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        detail: (err as Record<string, unknown>)?.detail ?? null,
        code:   (err as Record<string, unknown>)?.code   ?? null,
      }));
      // DB エラーでも LINE には 200 を返す（再送ループを防ぐ）
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
