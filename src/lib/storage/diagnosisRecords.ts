// ─── 手動鑑定データ保存（localStorage） ──────────────────────────────────────
// 既存の repository.ts パターンに合わせた実装。
// 将来 AI 学習材料として取り回しやすいよう customerId / tags / type を必ず保持する。

const LS_KEY = "crm_diagnosis_records_v1";

export type DiagnosisRecordType = "free" | "paid" | "upsell" | "premium";

export const DIAGNOSIS_TYPE_LABELS: Record<DiagnosisRecordType, string> = {
  free:    "無料鑑定",
  paid:    "有料鑑定",
  upsell:  "アップセル鑑定",
  premium: "上位プラン",
};

export type DiagnosisRecord = {
  id: string;
  customerId: string;
  customerName: string;
  type: DiagnosisRecordType;
  text: string;
  createdAt: string; // ISO8601
  tags: string[];
};

// ── 内部ヘルパー ─────────────────────────────────────────────────────────────

function readAll(): DiagnosisRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DiagnosisRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: DiagnosisRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(records));
  } catch { /* QuotaExceededError 等は無視 */ }
}

// ── 公開 API ─────────────────────────────────────────────────────────────────

/** 全件または顧客絞り込みで取得（新しい順） */
export function getDiagnosisRecords(customerId?: string): DiagnosisRecord[] {
  const all = readAll();
  const filtered = customerId
    ? all.filter((r) => r.customerId === String(customerId))
    : all;
  return filtered.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** 新規保存（id / createdAt は自動付与） */
export function saveDiagnosisRecord(
  record: Omit<DiagnosisRecord, "id" | "createdAt">
): DiagnosisRecord {
  const all = readAll();
  const newRecord: DiagnosisRecord = {
    ...record,
    id: `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  writeAll([newRecord, ...all]);
  return newRecord;
}

/** 直近 N 件（全顧客）を取得 */
export function getRecentDiagnosisRecords(limit = 20): DiagnosisRecord[] {
  return readAll()
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/** タグでフィルタ（いずれか一致） */
export function getDiagnosisRecordsByTags(tags: string[]): DiagnosisRecord[] {
  if (tags.length === 0) return [];
  return readAll().filter((r) => r.tags.some((t) => tags.includes(t)));
}

/** 削除 */
export function deleteDiagnosisRecord(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}
