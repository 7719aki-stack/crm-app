// ─── 鑑定ヒアリング情報 ──────────────────────────────────
// 顧客ごとの入力情報を localStorage に保存・取得する。
// 将来のタグ自動化・シナリオ分岐で参照しやすいよう純粋なキーバリュー構造。

export interface CustomerInterview {
  customerId: number;
  clientName: string;   // 名前
  birthDate:  string;   // 生年月日（YYYY-MM-DD 推奨、自由入力も可）
  concern:    string;   // 悩み内容
  updatedAt:  string;   // 最終保存日時（ISO）
}

export type InterviewInput = Pick<CustomerInterview, "clientName" | "birthDate" | "concern">;

const LS_KEY = "crm_interviews_v1";

// ─── localStorage ヘルパー ────────────────────────────────

function lsRead(): CustomerInterview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CustomerInterview[]) : [];
  } catch { return []; }
}

function lsWrite(items: CustomerInterview[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

// ─── 公開関数 ──────────────────────────────────────────────

/**
 * 指定顧客のヒアリング情報を取得する。
 * 未保存の場合は null を返す。
 */
export function getCustomerInterview(customerId: number): CustomerInterview | null {
  return lsRead().find((i) => i.customerId === customerId) ?? null;
}

/**
 * 悩み内容のテキストからタグラベルを自動検出する。
 * tagMaster の "01_worry" グループのラベルに対応。
 */
export function detectConcernTags(concern: string): string[] {
  const detected: string[] = [];
  if (concern.includes("復縁"))                              detected.push("復縁");
  if (concern.includes("片思い"))                            detected.push("片思い・進展");
  if (concern.includes("不倫") || concern.includes("複雑"))  detected.push("不倫・複雑愛");
  if (concern.includes("仕事") || concern.includes("人間関係")) detected.push("人間関係・仕事");
  return detected;
}

/**
 * 指定顧客のヒアリング情報を保存（上書き）する。
 */
export function saveCustomerInterview(customerId: number, data: InterviewInput): CustomerInterview {
  const all = lsRead();
  const updated: CustomerInterview = {
    customerId,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const exists = all.some((i) => i.customerId === customerId);
  lsWrite(
    exists
      ? all.map((i) => (i.customerId === customerId ? updated : i))
      : [...all, updated],
  );
  return updated;
}
