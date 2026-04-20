/**
 * LINE Webhook URL 自動取得 & クリップボードコピー
 *
 * 将来拡張メモ:
 *   Puppeteer で完全自動化可能。
 *   LINE Developers Console (https://developers.line.biz/console/) に
 *   headless ブラウザでログインし、Webhook URL フィールドに自動入力できる。
 *   実装例: puppeteer.launch() → page.goto(consoleUrl) → page.fill('#webhookUrl', url)
 */

import { execSync } from "child_process";
import * as http from "http";

const NGROK_API = "http://127.0.0.1:4040/api/tunnels";
const WEBHOOK_PATH = "/api/line/webhook";

function separator() {
  console.log("--------------------------------");
}

function getNgrokUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(NGROK_API, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const tunnels: { proto: string; public_url: string }[] =
            json.tunnels ?? [];

          if (tunnels.length === 0) {
            reject(
              new Error(
                "ngrok トンネルが見つかりません。ngrok が起動しているか確認してください。"
              )
            );
            return;
          }

          const https = tunnels.find((t) => t.proto === "https");
          const url = (https ?? tunnels[0]).public_url;

          if (!url) {
            reject(new Error("public_url が空です。ngrok の状態を確認してください。"));
            return;
          }

          resolve(url);
        } catch {
          reject(new Error("ngrok API レスポンスの解析に失敗しました。"));
        }
      });
    });

    req.on("error", () => {
      reject(
        new Error(
          "ngrok API (port 4040) に接続できません。ngrok が起動しているか確認してください。"
        )
      );
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("ngrok API への接続がタイムアウトしました (5秒)。"));
    });
  });
}

function copyToClipboard(text: string): boolean {
  try {
    // WSL / Windows 両対応: clip.exe を使用
    execSync(`echo ${text} | clip.exe`, { stdio: "pipe" });
    return true;
  } catch {
    try {
      // fallback: PowerShell
      execSync(
        `powershell.exe -NoProfile -Command "Set-Clipboard -Value '${text}'"`,
        { stdio: "pipe" }
      );
      return true;
    } catch {
      return false;
    }
  }
}

async function main() {
  separator();
  console.log("LINE AUTO SETUP");
  separator();
  console.log("");

  let ngrokUrl: string;

  try {
    ngrokUrl = await getNgrokUrl();
  } catch (err) {
    console.error("[ERROR]", (err as Error).message);
    console.log("");
    console.log("対処方法:");
    console.log("  1. ngrok を起動: ngrok http 3000");
    console.log("  2. このスクリプトを再実行してください");
    separator();
    process.exit(1);
  }

  const webhookUrl = `${ngrokUrl}${WEBHOOK_PATH}`;
  const copied = copyToClipboard(webhookUrl);

  console.log("ngrok URL:");
  console.log(`  ${ngrokUrl}`);
  console.log("");
  console.log("Webhook URL:");
  console.log(`  ${webhookUrl}`);
  console.log("");

  if (copied) {
    console.log("（クリップボードにコピー済み）");
  } else {
    console.log("（クリップボードへのコピーに失敗しました。手動でコピーしてください）");
  }

  console.log("");
  separator();
  console.log("");
  console.log("LINE Developers Console でこのURLを設定してください:");
  console.log("  https://developers.line.biz/console/");
  console.log("  チャンネル設定 > Messaging API > Webhook URL");
  separator();
}

main();
