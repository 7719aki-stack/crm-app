import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { sql } from "@/lib/db";
import { detectKeywords, applyTagChanges } from "@/lib/keywordRules";
import { detectMessageTags } from "@/lib/detectMessageTags";
import { detectCustomerStatus } from "@/lib/detectCustomerStatus";
import type { StatusId } from "@/lib/statuses";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const ACCESS_TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

// ─── 署名検証 ─────────────────────────────────────────────
function verifySignature(body: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return false;
  const hmac     = crypto.createHmac("sha256", CHANNEL_SECRET);
  hmac.update(body);
  const expected = hmac.digest("base64");
  return expected === signature;
}

// ─── LINE プロフィール取得 ────────────────────────────────
interface LineProfile {
  userId:        string;
  displayName:   string;
  pictureUrl?:   string;
  statusMessage?: string;
}

async function fetchLineProfile(userId: string): Promise<LineProfile | null> {
  if (!ACCESS_TOKEN) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<LineProfile>;
  } catch {
    return null;
  }
}

// ─── 顧客upsert ──────────────────────────────────────────
async function upsertCustomer(
  lineUserId: string,
  profile: LineProfile | null,
): Promise<number> {
  const [existing] = await sql<{ id: number }[]>`
    SELECT id FROM customers WHERE line_user_id = ${lineUserId}
  `;

  if (existing) {
    if (profile) {
      await sql`
        UPDATE customers
        SET display_name = ${profile.displayName},
            picture_url = ${profile.pictureUrl ?? null},
            status_message = ${profile.statusMessage ?? null},
            updated_at = NOW()
        WHERE id = ${existing.id}
      `;
    }
    return existing.id;
  }

  const displayName = profile?.displayName ?? lineUserId;
  const [result] = await sql<{ id: number }[]>`
    INSERT INTO customers (name, display_name, line_user_id, picture_url, status_message, status, tags, category)
    VALUES (
      ${displayName},
      ${displayName},
      ${lineUserId},
      ${profile?.pictureUrl ?? null},
      ${profile?.statusMessage ?? null},
      'new_reg',
      '[]',
      '片思い'
    )
    RETURNING id
  `;

  return result.id;
}

// ─── メッセージ保存 ───────────────────────────────────────
async function saveMessage(
  customerId: number,
  text: string,
  rawType: string,
): Promise<void> {
  await sql`
    INSERT INTO messages (customer_id, source, direction, text, raw_type)
    VALUES (${customerId}, 'line', 'inbound', ${text}, ${rawType})
  `;

  await sql`
    UPDATE customers SET updated_at = NOW() WHERE id = ${customerId}
  `;
}

// ─── キーワード自動タグ付け ───────────────────────────────
async function applyAutoTags(customerId: number, text: string): Promise<void> {
  const [row] = await sql<{ tags: string }[]>`
    SELECT tags FROM customers WHERE id = ${customerId}
  `;
  if (!row) return;

  const currentTags = JSON.parse(row.tags || "[]") as string[];
  const result      = detectKeywords(text, currentTags);

  if (result.addedTags.length === 0 && result.removedTags.length === 0) return;

  const newTags = applyTagChanges(currentTags, result);
  await sql`
    UPDATE customers SET tags = ${JSON.stringify(newTags)}, updated_at = NOW() WHERE id = ${customerId}
  `;
}

// ─── 悩みタグ付け ＋ ステータス自動更新 ─────────────────────
async function applyMessageTagsAndStatus(
  customerId: number,
  text: string,
): Promise<void> {
  const [row] = await sql<{ tags: string; status: string }[]>`
    SELECT tags, status FROM customers WHERE id = ${customerId}
  `;
  if (!row) return;

  const currentTags   = JSON.parse(row.tags || "[]") as string[];
  const currentStatus = row.status as StatusId;

  const newTags   = detectMessageTags(text).filter((t) => !currentTags.includes(t));
  const newStatus = detectCustomerStatus(text, currentStatus);

  if (newTags.length === 0 && !newStatus) return;

  const mergedTags = newTags.length > 0
    ? JSON.stringify([...currentTags, ...newTags])
    : null;

  if (newStatus && mergedTags) {
    await sql`UPDATE customers SET status = ${newStatus}, tags = ${mergedTags}, updated_at = NOW() WHERE id = ${customerId}`;
  } else if (newStatus) {
    await sql`UPDATE customers SET status = ${newStatus}, updated_at = NOW() WHERE id = ${customerId}`;
  } else {
    await sql`UPDATE customers SET tags = ${mergedTags!}, updated_at = NOW() WHERE id = ${customerId}`;
  }
}

// ─── LINE Event 型 ────────────────────────────────────────
interface LineMessageEvent {
  type: "message";
  source: { userId?: string };
  message: { type: string; text?: string };
}

interface LineFollowEvent {
  type: "follow";
  source: { userId?: string };
}

type LineEvent = LineMessageEvent | LineFollowEvent | { type: string; source: { userId?: string } };

// ─── POST /api/line/webhook ────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody   = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (CHANNEL_SECRET && !verifySignature(rawBody, signature)) {
    console.warn("[webhook] 署名検証失敗");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const event of body.events ?? []) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    const profile    = await fetchLineProfile(lineUserId);
    const customerId = await upsertCustomer(lineUserId, profile);

    if (event.type === "message") {
      const msgEvent = event as LineMessageEvent;
      const text     = msgEvent.message.text ?? "";
      const rawType  = msgEvent.message.type;

      if (rawType === "text" && text) {
        await saveMessage(customerId, text, rawType);
        await applyAutoTags(customerId, text);
        await applyMessageTagsAndStatus(customerId, text);
      }
    }
    // follow イベントは顧客作成のみ
  }

  return NextResponse.json({ ok: true });
}
