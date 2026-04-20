// POST /api/upsell
//
// アップセル・リマインドLINE送信API
//
// body: { customer_id, type: "upsell" | "reminder", upsell_price? }
//
// type="upsell"   → 購入済み顧客にアップセルオファーを送信（ログ: upsell accepted=true）
// type="reminder" → 未購入顧客にクリック後リマインドを送信

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getLastClickVariant, logUpsellEvent } from "@/lib/abTest";

const UPSELL_DEFAULT_PRICE = 10_000;

// ── メッセージテンプレート ────────────────────────────────

function buildUpsellMessage(name: string, price: number): string {
  return `${name} 様、先ほどはご購入ありがとうございました✨

ご購入者様限定の特別オファーをご案内します。

━━━━━━━━━━━━━━━━━
【深層鑑定プラン】¥${price.toLocaleString()}
━━━━━━━━━━━━━━━━━

通常鑑定では届かない、あなたの深層心理・縁の流れ・最善の行動指針まで徹底鑑定します。

✅ 深層心理・潜在的な感情の流れ
✅ 今後3ヶ月の縁の動きと転換点
✅ 具体的な行動プランのアドバイス
✅ 追加質問無制限（3日間）

購入者様のみの特別価格です。ご希望の方はこのまま返信してください。`;
}

function buildReminderMessage(name: string): string {
  return `${name} 様、こんにちは。

先ほど鑑定ページをご覧いただきありがとうございます。

まだご検討中でしたら、ぜひこの機会にどうぞ💫
あなたの状況に合わせた鑑定をお届けします。

ご質問があればいつでも返信してください。`;
}

// ── ルートハンドラー ─────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      customer_id:  number;
      type:         "upsell" | "reminder";
      upsell_price?: number;
      product_id?:  string;
    };

    const { customer_id, type, upsell_price = UPSELL_DEFAULT_PRICE } = body;

    if (!customer_id || (type !== "upsell" && type !== "reminder")) {
      return NextResponse.json(
        { error: "customer_id と type (upsell|reminder) は必須です" },
        { status: 400 },
      );
    }

    // 顧客情報を取得
    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("id, name, display_name, line_user_id")
      .eq("id", customer_id)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
    }

    if (!customer.line_user_id) {
      return NextResponse.json(
        { error: "LINE連携が未設定です。顧客詳細から line_user_id を設定してください" },
        { status: 422 },
      );
    }

    const displayName = customer.display_name ?? customer.name;
    const message =
      type === "upsell"
        ? buildUpsellMessage(displayName, upsell_price)
        : buildReminderMessage(displayName);

    // LINE push 送信（内部 API 呼び出し）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const pushRes = await fetch(`${baseUrl}/api/line/push`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to: customer.line_user_id, text: message }),
    });

    if (!pushRes.ok) {
      const detail = await pushRes.json().catch(() => ({}));
      console.error("[POST /api/upsell] LINE push failed:", detail);
      return NextResponse.json(
        { error: "LINE送信に失敗しました", detail },
        { status: pushRes.status },
      );
    }

    // ── アップセル成約をログ + メッセージ履歴に記録 ───────
    if (type === "upsell") {
      const variant = getLastClickVariant(customer_id);
      if (variant) {
        logUpsellEvent(customer_id, variant, upsell_price, true);
      }

      await supabase.from("messages").insert({
        customer_id,
        source:    "crm",
        direction: "outbound",
        text:      `[アップセル送信] ¥${upsell_price.toLocaleString()} オファー`,
        raw_type:  "upsell",
      });

      // 購入ログ（後で分析に使う）。失敗しても本処理を止めない。
      void Promise.resolve().then(async () => {
        try {
          await supabase.from("purchase_logs").insert({
            customer_id:  String(customer_id),
            product_id:   body.product_id ?? "unknown",
            price:        upsell_price,
            purchased_at: new Date().toISOString(),
          });
        } catch { /* ログ失敗は無視 */ }
      });
    } else {
      // リマインドもメッセージ履歴に残す
      await supabase.from("messages").insert({
        customer_id,
        source:    "crm",
        direction: "outbound",
        text:      `[自動リマインド] クリック後フォローアップ`,
        raw_type:  "reminder_followup",
      });
    }

    return NextResponse.json({ ok: true, type, to: customer.line_user_id });
  } catch (e) {
    console.error("[POST /api/upsell]", e);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
