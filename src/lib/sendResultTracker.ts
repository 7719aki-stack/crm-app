// ── 送信結果トラッキング（localStorage）────────────────────
// 手動送信後に「未反応/返信あり/興味あり/成約」を記録して
// テンプレごとの成約率・売上を集計する。

const LS_KEY = "crm_send_results";

export type SendResultType = "no_response" | "replied" | "interested" | "converted";

export const SEND_RESULT_LABELS: Record<SendResultType, string> = {
  no_response: "未反応",
  replied:     "返信あり",
  interested:  "興味あり",
  converted:   "成約",
};

export type SendResult = {
  id:            string;
  customerId:    number;
  templateId:    string | null;
  templateLabel: string | null;
  result:        SendResultType;
  revenue:       number;     // 成約時のみ > 0
  timestamp:     string;     // ISO8601
};

export type TemplateStats = {
  templateId:     string;
  templateLabel:  string;
  totalSent:      number;
  conversions:    number;
  revenue:        number;
  conversionRate: number;   // 0〜1
};

function readAll(): SendResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SendResult[]) : [];
  } catch {
    return [];
  }
}

export function saveSendResult(data: Omit<SendResult, "id">): SendResult {
  const record: SendResult = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  if (typeof window === "undefined") return record;
  try {
    const all = readAll();
    all.push(record);
    // 最大 2000 件まで保持
    localStorage.setItem(LS_KEY, JSON.stringify(all.slice(-2000)));
  } catch { /* QuotaExceededError 等は無視 */ }
  return record;
}

export function getSendResults(): SendResult[] {
  return readAll();
}

// テンプレごとに集計（templateId が null のものは除外）
export function getTemplateStats(sortBy: "revenue" | "cvr" = "revenue"): TemplateStats[] {
  const results = readAll().filter((r) => r.templateId !== null);
  const map = new Map<string, TemplateStats>();

  for (const r of results) {
    const key = r.templateId!;
    if (!map.has(key)) {
      map.set(key, {
        templateId:     key,
        templateLabel:  r.templateLabel ?? key,
        totalSent:      0,
        conversions:    0,
        revenue:        0,
        conversionRate: 0,
      });
    }
    const s = map.get(key)!;
    s.totalSent++;
    if (r.result === "converted") {
      s.conversions++;
      s.revenue += r.revenue;
    }
  }

  for (const s of map.values()) {
    s.conversionRate = s.totalSent > 0 ? s.conversions / s.totalSent : 0;
  }

  const sorted = [...map.values()];
  if (sortBy === "cvr") {
    sorted.sort((a, b) => b.conversionRate - a.conversionRate || b.revenue - a.revenue);
  } else {
    sorted.sort((a, b) => b.revenue - a.revenue || b.conversionRate - a.conversionRate);
  }
  return sorted;
}
