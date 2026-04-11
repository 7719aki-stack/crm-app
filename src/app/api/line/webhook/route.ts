import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

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

    const line_user_id = (ev.source as Record<string, unknown> | undefined)?.userId as string | undefined;
    const text         = (msg.text as string | undefined) ?? "";

    if (!line_user_id) {
      console.error("[webhook] line_user_id is missing in event", ev);
      continue;
    }

    try {
      // 既存顧客を検索
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("line_user_id", line_user_id)
        .maybeSingle();

      let customerId: number | null = null;

      if (existing) {
        // 既存顧客: updated_at のみ更新（name は保持）
        customerId = existing.id;
        await supabase
          .from("customers")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        // 新規顧客: 作成（name は line_user_id を仮置き）
        const { data: created, error: insertError } = await supabase
          .from("customers")
          .insert({ line_user_id, name: line_user_id })
          .select("id")
          .single();

        if (insertError) {
          console.error("[webhook] customer insert error", insertError);
          continue;
        }
        customerId = created?.id ?? null;
      }

      if (customerId == null) {
        console.error("[webhook] customerId not found after upsert", { line_user_id });
        continue;
      }

      // messages 保存
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          customer_id: customerId,
          source:      "line",
          direction:   "inbound",
          text,
        });

      if (msgError) {
        console.error("[webhook] message insert error", msgError);
      }
    } catch (err) {
      console.error("[webhook] error", {
        line_user_id,
        text,
        error: err instanceof Error ? err.message : String(err),
      });
      // DB エラーでも LINE には 200 を返す（再送ループを防ぐ）
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
