// ─── リマインダークリックログ API ────────────────────────────────────────────
// POST /api/log/reminder
// Body: { customerId, variant, sendCount, clickedAt }
// → logs/reminder.log に JSON Lines 形式で追記する

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "logs", "reminder.log");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, variant, sendCount, clickedAt } = body;

    if (
      typeof customerId !== "number" ||
      (variant !== "A" && variant !== "B") ||
      typeof sendCount !== "number" ||
      typeof clickedAt !== "string"
    ) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const log = { customerId, variant, sendCount, clickedAt };
    fs.appendFileSync(LOG_PATH, JSON.stringify(log) + "\n");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "log write failed" }, { status: 500 });
  }
}
