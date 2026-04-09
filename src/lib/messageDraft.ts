// ─── 顧客別・送信文ドラフト localStorage ヘルパー ──────────────
// キー: customerMessageDrafts → { [customerId]: string }

const LS_KEY = "customerMessageDrafts";

type DraftMap = Record<string | number, string>;

function readMap(): DraftMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DraftMap) : {};
  } catch {
    return {};
  }
}

export function getCustomerMessageDraft(customerId: number | string): string {
  return readMap()[customerId] ?? "";
}

export function saveCustomerMessageDraft(
  customerId: number | string,
  draft: string
): void {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    map[customerId] = draft;
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* QuotaExceededError 等は無視 */
  }
}

export function clearCustomerMessageDraft(customerId: number | string): void {
  saveCustomerMessageDraft(customerId, "");
}
