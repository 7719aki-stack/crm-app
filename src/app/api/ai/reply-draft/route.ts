import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getRecommendedTemplates } from "@/lib/recommendTemplates";
import { getStatus } from "@/lib/statuses";
import type { StatusId } from "@/lib/statuses";

// ── ソース型 ─────────────────────────────────────────────
type DraftSource = "openai" | "anthropic" | "fallback";

// ── 温度感ベースのオープナー ─────────────────────────────
const TEMP_OPENER: Record<string, string> = {
  hot:  "今の気持ち、しっかり受け取りました。",
  warm: "お話聞かせてくれてありがとうございます。",
  cool: "メッセージありがとうございます。",
  cold: "連絡くれて嬉しいです。",
};

// ── フォールバック：テンプレートから文案を組み立て ───────
function buildFallbackDraft(
  name: string,
  temperature: string,
  tags: string[],
  status: string,
  consultation: string | null,
): string {
  const customerCtx = {
    status,
    temperature,
    tags,
    consultation: consultation ?? undefined,
  };

  const templates = getRecommendedTemplates(customerCtx, 3);
  if (templates.length > 0) {
    const t = templates[0];
    // テンプレ本文をそのまま返す（名前を差し込む）
    const san = name ? `${name}さん、` : "";
    const body = t.body;
    // 先頭に「さん」を付けていない場合のみ付与
    if (body.startsWith(name) || body.startsWith("さん") || body.includes(name)) {
      return body;
    }
    return `${san}${body}`;
  }

  // 超フォールバック
  const opener = TEMP_OPENER[temperature] ?? TEMP_OPENER.cool;
  return `${name ? `${name}さん、` : ""}${opener}\nその後いかがですか？\n気になっていたのでご連絡しました。`;
}

// ── プロンプト構築 ────────────────────────────────────────
function buildPrompt(params: {
  name:         string;
  category:     string;
  statusLabel:  string;
  temperature:  string;
  tags:         string[];
  consultation: string | null;
  nextAction:   string | null;
  messages:     Array<{ direction: string; text: string; created_at: string }>;
}): { system: string; user: string } {
  const { name, category, statusLabel, temperature, tags, consultation, nextAction, messages } = params;

  const tempMap: Record<string, string> = {
    hot: "熱い（非常に関心が高い）",
    warm: "温まり中（積極的）",
    cool: "普通",
    cold: "冷え気味（距離感あり）",
  };

  const msgHistory = messages
    .slice(-5)
    .map((m) => {
      const dt = m.created_at.slice(0, 16).replace("T", " ");
      const role = m.direction === "inbound" ? "【顧客】" : "【スタッフ】";
      return `${role} ${dt}\n${m.text}`;
    })
    .join("\n\n");

  const system = `あなたは恋愛・人間関係の占い師のアシスタントです。
顧客への LINE 返信文案を1件生成します。

生成方針:
- 200〜400文字程度
- 温かく、やわらかい文体。押し売り感ゼロ
- 顧客の不安・悩みをまず受け止める（共感ファースト）
- 必要なら、次のステップへ自然に誘導する
- 有料案内が文脈上自然なら、弱めに1文添える程度でよい
- 「コピペ感」が出ない自然な日本語にする
- 返信文のみを出力。説明・JSON・記号は不要`;

  const user = `顧客情報:
名前: ${name}さん
カテゴリ: ${category}
現在ステータス: ${statusLabel}
温度感: ${tempMap[temperature] ?? temperature}
タグ: ${tags.join(", ") || "なし"}
${consultation ? `相談内容: ${consultation}` : ""}
${nextAction ? `次回アクション予定: ${nextAction}` : ""}

直近のメッセージ履歴:
${msgHistory || "（履歴なし）"}

上記をふまえて、${name}さんへの返信文を1件作成してください。`;

  return { system, user };
}

// ── OpenAI 呼び出し ─────────────────────────────────────
async function callOpenAI(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model:      "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

// ── Anthropic 呼び出し ────────────────────────────────────
async function callAnthropic(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new Error("Anthropic returned empty response");
  return text;
}

// ── POST /api/ai/reply-draft ───────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { customerId?: unknown };
  const customerId = typeof body.customerId === "number" ? body.customerId : NaN;

  if (isNaN(customerId)) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  // ── 顧客情報取得（consultation / funnel_stage は存在しないカラムのため * で取得）
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (custErr || !customer) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  // ── 直近5件メッセージ取得 ───────────────────────────────
  const { data: rawMsgs } = await supabase
    .from("messages")
    .select("direction, text, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(5);

  const messages = ((rawMsgs ?? []) as Array<{ direction: string; text: string; created_at: string }>).reverse();

  // ── タグ配列に変換 ──────────────────────────────────────
  const tags: string[] = (() => {
    try {
      const t = customer.tags;
      if (typeof t === "string") return JSON.parse(t) as string[];
      if (Array.isArray(t)) return t as string[];
      return [];
    } catch { return []; }
  })();

  const name        = customer.display_name ?? customer.name ?? "";
  const temperature = customer.temperature as string ?? "cool";
  const status      = customer.status as string ?? "new_reg";
  const statusLabel = getStatus(status as StatusId)?.label ?? status;
  const consultation: string | null = customer.consultation ?? customer.notes ?? null;
  const nextAction: string | null   = customer.next_action ?? null;

  // ── プロンプト生成 ──────────────────────────────────────
  const { system, user } = buildPrompt({
    name,
    category:     customer.category ?? "未設定",
    statusLabel,
    temperature,
    tags,
    consultation,
    nextAction,
    messages,
  });

  // ── AI呼び出し（OpenAI → Anthropic → fallback）────────
  let draft = "";
  let source: DraftSource = "fallback";
  const errors: string[] = [];

  // OpenAI
  if (!draft && process.env.OPENAI_API_KEY) {
    try {
      draft  = await callOpenAI(system, user);
      source = "openai";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`OpenAI: ${msg}`);
      console.warn("[reply-draft] OpenAI failed:", msg);
    }
  }

  // Anthropic
  if (!draft && process.env.ANTHROPIC_API_KEY) {
    try {
      draft  = await callAnthropic(system, user);
      source = "anthropic";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Anthropic: ${msg}`);
      console.warn("[reply-draft] Anthropic failed:", msg);
    }
  }

  // テンプレートフォールバック
  if (!draft) {
    draft  = buildFallbackDraft(name, temperature, tags, status, consultation);
    source = "fallback";
    if (errors.length > 0) {
      console.warn("[reply-draft] All AI providers failed, using fallback. Errors:", errors);
    }
  }

  return NextResponse.json({ draft, source });
}
