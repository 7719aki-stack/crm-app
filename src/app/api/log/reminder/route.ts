// ─── リマインダーイベントログ API ────────────────────────────────────────────
// POST /api/log/reminder
//
// Body（click）:
//   { event:"click", customerId, variant, sendCount, clickedAt }
//   ※ event 省略時も click として扱う（旧フォーマット互換）
//
// Body（purchase）:
//   { event:"purchase", customerId, variant }
//
// → logs/reminder.log に JSON Lines 形式で追記する

import { NextRequest, NextResponse } from "next/server";
import fs   from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "logs", "reminder.log");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event = "click", customerId, variant, sendCount, clickedAt, purchasedAt } = body as {
      event?:       string;
      customerId:   number;
      variant:      string;
      sendCount?:   number;
      clickedAt?:   string;
      purchasedAt?: string;
    };

    if (typeof customerId !== "number" || (variant !== "A" && variant !== "B")) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    let log: Record<string, unknown>;

    if (event === "purchase") {
      log = {
        event:       "purchase",
        customerId,
        variant,
        purchasedAt: purchasedAt ?? new Date().toISOString(),
      };
    } else {
      // click（旧フォーマット互換も含む）
      if (typeof sendCount !== "number" || typeof clickedAt !== "string") {
        return NextResponse.json({ error: "click requires sendCount + clickedAt" }, { status: 400 });
      }
      log = { event: "click", customerId, variant, sendCount, clickedAt };
    }

    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(log) + "\n");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "log write failed" }, { status: 500 });
  }
}
