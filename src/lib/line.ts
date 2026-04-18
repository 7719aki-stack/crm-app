// LINE プッシュメッセージ送信 共通ヘルパー（サーバーサイド専用）

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export class LineApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly detail: unknown,
  ) {
    super(message);
    this.name = "LineApiError";
  }
}

/**
 * LINE プッシュメッセージを 1 件送信する。
 * 失敗時は LineApiError をスローする（呼び出し元でキャッチして再送判断を行う）。
 */
export async function sendLinePush(to: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
  if (!to)    throw new Error("LINE user ID が空です");

  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: text.trim() }],
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ message: res.statusText }));
    throw new LineApiError(`LINE API error ${res.status}`, res.status, detail);
  }
}
