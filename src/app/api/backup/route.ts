// GET /api/backup – SQLite DBをバックアップしてファイル情報を返す
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DB_PATH     = path.join(process.cwd(), "data", "love-crm.db");
const BACKUP_DIR  = path.join(process.cwd(), "data", "backup");

export async function GET() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json({ error: "DBファイルが見つかりません" }, { status: 404 });
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now      = new Date();
    const pad      = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `love-crm-${datePart}-${timePart}.db`;
    const destPath = path.join(BACKUP_DIR, filename);

    fs.copyFileSync(DB_PATH, destPath);

    const stat     = fs.statSync(destPath);
    const sizeKB   = Math.round(stat.size / 1024);

    return NextResponse.json({
      ok:       true,
      filename,
      sizeKB,
      createdAt: now.toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/backup]", e);
    return NextResponse.json({ error: "バックアップに失敗しました" }, { status: 500 });
  }
}
