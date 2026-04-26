// ── 営業ダッシュボード ─────────────────────────────────────
// 優先顧客ランキング・フォロー対象・今日のタスク集計

import { getDb } from "./db";
import { calculateCustomerScore } from "./customerScore";
import { getStatus } from "./statuses";
import type { StatusId } from "./statuses";

export type PriorityCustomer = {
  id:           number;
  name:         string;
  display_name: string;
  status:       string;
  temperature:  string;
  line_user_id: string | null;
  next_action:  string | null;
  score:        number;
  scoreLabel:   "高" | "中" | "低";
  scoreReasons: string[];
};

export type FollowUpTarget = {
  id:           number;
  name:         string;
  display_name: string;
  status:       string;
  temperature:  string;
  line_user_id: string | null;
  hoursElapsed: number;
  lastSentAt:   string;
};

export type TodaysSummary = {
  priorityCount: number;
  followUpCount: number;
  overdueCount:  number;
  totalToSend:   number;
};

// ── 優先顧客ランキング（スコア降順 TOP N）────────────────
export function getPriorityCustomers(limit = 5): PriorityCustomer[] {
  try {
    const db   = getDb();
    const rows = db.prepare(`
      SELECT id, name, display_name, status, temperature,
             line_user_id, next_action, tags, updated_at
      FROM customers
      WHERE status != 'churned'
    `).all() as Array<{
      id: number; name: string; display_name: string | null;
      status: string; temperature: string; line_user_id: string | null;
      next_action: string | null; tags: string; updated_at: string;
    }>;

    return rows
      .map((r) => {
        const tags: string[] = (() => {
          try { return JSON.parse(r.tags || "[]"); } catch { return []; }
        })();
        const lastContact = r.updated_at ? String(r.updated_at).slice(0, 10) : undefined;
        const { score, label, reasons } = calculateCustomerScore({
          status:       r.status,
          temperature:  r.temperature,
          tags,
          line_user_id: r.line_user_id,
          next_action:  r.next_action,
          last_contact: lastContact,
        });
        return {
          id:           r.id,
          name:         r.name,
          display_name: r.display_name ?? r.name,
          status:       r.status,
          temperature:  r.temperature,
          line_user_id: r.line_user_id,
          next_action:  r.next_action,
          score,
          scoreLabel:   label,
          scoreReasons: reasons,
        };
      })
      .filter((c) => getStatus(c.status as StatusId)?.group !== "exit")
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (e) {
    console.error("[getPriorityCustomers]", e);
    return [];
  }
}

// ── フォロー対象（送信後 24h 以上・返信なし）───────────
export function getFollowUpTargets(limit = 10): FollowUpTarget[] {
  try {
    const db   = getDb();
    const rows = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.display_name,
        c.status,
        c.temperature,
        c.line_user_id,
        lo.last_sent_at,
        CAST((julianday('now') - julianday(lo.last_sent_at)) * 24 AS INTEGER) AS hours_elapsed
      FROM customers c
      INNER JOIN (
        SELECT customer_id, MAX(created_at) AS last_sent_at
        FROM messages
        WHERE direction = 'outbound'
        GROUP BY customer_id
      ) lo ON c.id = lo.customer_id
      WHERE
        c.status NOT IN ('churned')
        AND CAST((julianday('now') - julianday(lo.last_sent_at)) * 24 AS INTEGER) >= 24
        AND NOT EXISTS (
          SELECT 1 FROM messages
          WHERE customer_id = c.id
            AND direction = 'inbound'
            AND created_at > lo.last_sent_at
        )
      ORDER BY lo.last_sent_at ASC
      LIMIT ?
    `).all(limit) as Array<{
      id: number; name: string; display_name: string | null;
      status: string; temperature: string; line_user_id: string | null;
      last_sent_at: string; hours_elapsed: number;
    }>;

    return rows.map((r) => ({
      id:           r.id,
      name:         r.name,
      display_name: r.display_name ?? r.name,
      status:       r.status,
      temperature:  r.temperature,
      line_user_id: r.line_user_id,
      hoursElapsed: r.hours_elapsed,
      lastSentAt:   r.last_sent_at,
    }));
  } catch (e) {
    console.error("[getFollowUpTargets]", e);
    return [];
  }
}

// ── 今日のタスク集計 ──────────────────────────────────────
export function buildTodaysSummary(params: {
  priorityCustomers: PriorityCustomer[];
  followUpTargets:   FollowUpTarget[];
  overdueCount:      number;
}): TodaysSummary {
  const priorityIds  = new Set(params.priorityCustomers.map((p) => p.id));
  const followUpIds  = new Set(params.followUpTargets.map((f) => f.id));
  const uniqueToSend = new Set([...priorityIds, ...followUpIds]).size;

  return {
    priorityCount: params.priorityCustomers.filter((c) => c.line_user_id).length,
    followUpCount: params.followUpTargets.length,
    overdueCount:  params.overdueCount,
    totalToSend:   Math.min(uniqueToSend, 10),
  };
}
