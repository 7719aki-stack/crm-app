import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

async function fetchLineDisplayName(userId: string): Promise<string | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("[webhook] LINE_CHANNEL_ACCESS_TOKEN is not set");
    return null;
  }
  console.log("[webhook] fetching profile for userId:", userId);
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "(unreadable)");
      console.error("[webhook] profile error: status", res.status, errText);
      return null;
    }
    const data = await res.json() as { displayName?: string };
    console.log("[webhook] profile success:", { displayName: data.displayName });
    return data.displayName ?? null;
  } catch (err) {
    console.error("[webhook] profile error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

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
        .select("id, display_name")
        .eq("line_user_id", line_user_id)
        .maybeSingle();

      let customerId: number | null = null;

      if (existing) {
        // 既存顧客: display_name が空なら取得して更新
        customerId = existing.id;
        if (!existing.display_name) {
          const displayName = await fetchLineDisplayName(line_user_id);
          console.log("[webhook] updating customer display_name:", { id: existing.id, display_name: displayName });
          const { error: updateError } = await supabase
            .from("customers")
            .update({ updated_at: new Date().toISOString(), display_name: displayName ?? undefined })
            .eq("id", existing.id);
          if (updateError) {
            console.error("[webhook] customer update error:", updateError);
          } else {
            console.log("[webhook] customer updated: display_name set to", displayName);
          }
        } else {
          console.log("[webhook] customer already has display_name:", existing.display_name, "— skipping profile fetch");
          await supabase
            .from("customers")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      } else {
        // 新規顧客: displayName を取得して保存
        const displayName = await fetchLineDisplayName(line_user_id);
        console.log("[webhook] updating customer display_name:", { line_user_id, display_name: displayName });
        const { data: created, error: insertError } = await supabase
          .from("customers")
          .insert({ line_user_id, name: line_user_id, display_name: displayName ?? null })
          .select("id")
          .single();

        if (insertError) {
          console.error("[webhook] customer insert error", insertError);
          continue;
        }
        console.log("[webhook] customer updated: display_name set to", displayName);
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
