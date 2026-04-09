// ─── シナリオ定義 & キュー管理 ──────────────────────────
// 将来の自動送信に備えて、送信予定の生成・管理を純粋関数に分離。

// ─── 型定義 ────────────────────────────────────────────

export type ScenarioStatus = "pending" | "sent" | "skipped" | "cancelled";

export interface ScenarioQueueItem {
  id:          string;
  customerId:  number;
  scenarioKey: string;
  stepIndex:   number;
  scheduledAt: string;   // ISO datetime
  messageText: string;
  status:      ScenarioStatus;
}

export interface ScenarioStep {
  delayMinutes: number;
  messageText:  string;
}

export interface ScenarioDef {
  key:        string;
  label:      string;
  /** このタグが付与されたときにシナリオを開始する */
  triggerTag: string;
  steps:      ScenarioStep[];
}

// ─── シナリオマスタ ────────────────────────────────────

export const SCENARIO_MASTER: ScenarioDef[] = [
  {
    key:        "diagnosis_followup",
    label:      "鑑定フォローアップ",
    triggerTag: "鑑定待ち",
    steps: [
      {
        delayMinutes: 10,
        messageText:  "鑑定希望ありがとうございます。必要情報を確認していきます。",
      },
      {
        delayMinutes: 60,
        messageText:  "まだ大丈夫でしたら、このまま状況を教えてください。",
      },
      {
        delayMinutes: 1440, // 1日
        messageText:  "その後いかがですか？必要ならこのまま進められます。",
      },
    ],
  },
];

// ─── localStorage ヘルパー ─────────────────────────────

const LS_KEY = "crm_scenario_queue_v1";

function lsRead(): ScenarioQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ScenarioQueueItem[]) : [];
  } catch { return []; }
}

function lsWrite(items: ScenarioQueueItem[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

// ─── 公開関数 ──────────────────────────────────────────

/**
 * 指定シナリオを開始し、各ステップをキューに追加する。
 * 同じ customerId + scenarioKey の pending が既にある場合は重複作成しない。
 * @returns 追加されたキューアイテム一覧（重複時は空配列）
 */
export function startScenarioForCustomer(
  customerId:  number,
  scenarioKey: string,
): ScenarioQueueItem[] {
  const def = SCENARIO_MASTER.find((s) => s.key === scenarioKey);
  if (!def) return [];

  const all = lsRead();

  // 重複防止
  const hasPending = all.some(
    (item) =>
      item.customerId === customerId &&
      item.scenarioKey === scenarioKey &&
      item.status === "pending",
  );
  if (hasPending) return [];

  const now = new Date();
  const newItems: ScenarioQueueItem[] = def.steps.map((step, i) => ({
    id:          `${Date.now()}_${customerId}_${scenarioKey}_${i}`,
    customerId,
    scenarioKey,
    stepIndex:   i,
    scheduledAt: new Date(now.getTime() + step.delayMinutes * 60 * 1000).toISOString(),
    messageText: step.messageText,
    status:      "pending",
  }));

  lsWrite([...all, ...newItems]);
  return newItems;
}

/**
 * タグ一覧を受け取り、マッチするシナリオを全て開始する。
 * addedTags（今回新たに付与されたタグ）のみを見る。
 */
export function triggerScenariosForTags(
  customerId: number,
  addedTags:  string[],
): ScenarioQueueItem[] {
  const started: ScenarioQueueItem[] = [];
  for (const def of SCENARIO_MASTER) {
    if (addedTags.includes(def.triggerTag)) {
      const items = startScenarioForCustomer(customerId, def.key);
      started.push(...items);
    }
  }
  return started;
}

/**
 * 指定顧客のシナリオキューを scheduledAt 昇順で返す。
 */
export function getCustomerScenarioQueue(customerId: number): ScenarioQueueItem[] {
  return lsRead()
    .filter((item) => item.customerId === customerId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

/**
 * 指定 id のステータスを更新する。
 */
export function updateScenarioQueueStatus(id: string, status: ScenarioStatus): void {
  const all = lsRead();
  lsWrite(all.map((item) => (item.id === id ? { ...item, status } : item)));
}
