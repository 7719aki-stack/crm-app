import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// ── レスポンス型 ───────────────────────────────────────────
export interface ReplySuggestion {
  label: string;
  text:  string;
}

// ─── POST /api/customers/[id]/reply-suggestions ───────────
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  // ── 1. 顧客情報取得 ────────────────────────────────────
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, display_name, category, status, tags, notes")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  // ── 2. 直近 10 件のメッセージ取得 ─────────────────────
  const { data: rawMessages, error: msgError } = await supabase
    .from("messages")
    .select("direction, text, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (msgError) {
    return NextResponse.json(
      { error: "メッセージ取得に失敗しました" },
      { status: 500 }
    );
  }

  // 新しい順 → 古い順に並べ直す
  const recentMessages = (rawMessages ?? []).reverse();

  // ── 3. タグを配列に変換 ────────────────────────────────
  const tags: string[] = (() => {
    try {
      const t = customer.tags;
      if (typeof t === "string") return JSON.parse(t) as string[];
      if (Array.isArray(t)) return t as string[];
      return [];
    } catch {
      return [];
    }
  })();

  // ── 4. プロンプト構築 ──────────────────────────────────
  const messageHistory = recentMessages
    .map((m) => `[${m.direction === "inbound" ? "顧客" : "スタッフ"}] ${m.text}`)
    .join("\n");

  const systemPrompt = `あなたはLINE顧客対応アシスタントです。
目的は、相手に安心感を与え、自然に会話を継続し、必要に応じてサービス案内へつなげることです。

ルール:
- 丁寧でやさしい文体
- 120文字前後
- 相手の感情をまず受け止める
- 押し売りしない
- 断定しすぎない
- 日本語で返す
- 必ず指定のJSON形式で返す`;

  const userPrompt = `顧客情報:
名前: ${customer.display_name ?? customer.name}
カテゴリ: ${customer.category ?? "未設定"}
タグ: ${tags.join(", ") || "なし"}
${customer.notes ? `備考: ${customer.notes}` : ""}

直近のメッセージ履歴:
${messageHistory || "（履歴なし）"}

上記をふまえて、以下の3パターンの返信候補を作成してください。
必ず以下のJSON形式のみで返してください：

{
  "candidates": [
    { "label": "丁寧", "text": "..." },
    { "label": "親しみやすい", "text": "..." },
    { "label": "誘導強め", "text": "..." }
  ]
}`;

  // ── 5. Claude API 呼び出し ────────────────────────────
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 1024,
        system:     systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[reply-suggestions] Claude API error:", res.status, errBody);
      return NextResponse.json(
        { error: "AI生成に失敗しました。しばらくしてから再試行してください。" },
        { status: 500 }
      );
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const rawText = data.content.find((b) => b.type === "text")?.text ?? "{}";

    let parsed: { candidates?: ReplySuggestion[] };
    try {
      parsed = JSON.parse(rawText) as { candidates?: ReplySuggestion[] };
    } catch {
      console.error("[reply-suggestions] JSON parse error:", rawText);
      return NextResponse.json(
        { error: "AI返信候補の解析に失敗しました" },
        { status: 500 }
      );
    }

    const candidates = parsed.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { error: "AI返信候補の生成に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ candidates });
  } catch (e) {
    console.error("[reply-suggestions] Claude API error:", e);
    return NextResponse.json(
      { error: "AI生成に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }
}
