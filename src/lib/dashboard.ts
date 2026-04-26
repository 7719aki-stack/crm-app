// ── 営業ダッシュボード ─────────────────────────────────────
// 優先顧客ランキング・フォロー対象・今日のタスク集計

import { getDb } from "./db";
import { calculateCustomerScore } from "./customerScore";
import { getRecommendedTemplates } from "./recommendTemplates";
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

// ── 追客キュー ────────────────────────────────────────────
// 高スコア・フォロー候補・次アクション未設定・LINE未送信の中から
// 優先度順に並べた「今日やるべき相手」リスト
export type ChaseQueueItem = {
  id:           number;
  name:         string;
  display_name: string;
  score:        number;
  scoreLabel:   "高" | "中" | "低";
  scoreReasons: string[];
  queueReasons: string[];   // なぜキューに入っているか（表示用）
  next_action:  string | null;
  line_user_id: string | null;
  status:       string;
  temperature:  string;
  hoursElapsed: number | null;
  priority:     number;     // ソート用合成スコア
  bestTemplate: string | null; // 最適送信ボタン用・事前選択済みテンプレ本文（名前差し込み済み）
};

export function getChaseQueue(limit = 20): ChaseQueueItem[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.display_name,
        c.status,
        c.temperature,
        c.category,
        c.line_user_id,
        c.next_action,
        c.tags,
        c.updated_at,
        lo.last_sent_at,
        CASE
          WHEN lo.last_sent_at IS NOT NULL
          THEN CAST((julianday('now') - julianday(lo.last_sent_at)) * 24 AS INTEGER)
          ELSE NULL
        END AS hours_elapsed,
        CASE
          WHEN li.last_inbound_at IS NOT NULL
               AND lo.last_sent_at IS NOT NULL
               AND li.last_inbound_at > lo.last_sent_at
          THEN 1 ELSE 0
        END AS has_reply
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, MAX(created_at) AS last_sent_at
        FROM messages WHERE direction = 'outbound'
        GROUP BY customer_id
      ) lo ON c.id = lo.customer_id
      LEFT JOIN (
        SELECT customer_id, MAX(created_at) AS last_inbound_at
        FROM messages WHERE direction = 'inbound'
        GROUP BY customer_id
      ) li ON c.id = li.customer_id
      WHERE c.status NOT IN ('churned')
        AND c.line_user_id IS NOT NULL
    `).all() as Array<{
      id: number; name: string; display_name: string | null;
      status: string; temperature: string; category: string | null;
      line_user_id: string | null;
      next_action: string | null; tags: string; updated_at: string;
      last_sent_at: string | null; hours_elapsed: number | null;
      has_reply: number;
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

        // 各判定フラグ
        const isHighScore   = score >= 60;
        const isFollowUp    = (r.hours_elapsed ?? 0) >= 24
                              && r.has_reply === 0
                              && r.last_sent_at !== null;
        const noNextAction  = !r.next_action;
        const isLineNew     = !r.last_sent_at; // LINE登録済みで一度も送信なし

        // いずれかの条件を満たさなければキュー対象外
        if (!isHighScore && !isFollowUp && !noNextAction && !isLineNew) return null;
        // exit グループは除外（getStatus で確認）
        if (getStatus(r.status as StatusId)?.group === "exit") return null;

        const queueReasons: string[] = [];
        if (isHighScore)  queueReasons.push("高スコア");
        if (isFollowUp)   queueReasons.push(`${r.hours_elapsed}h未返信`);
        if (noNextAction) queueReasons.push("次アクション未設定");
        if (isLineNew)    queueReasons.push("LINE未送信");

        // 優先度: フォロー経過時間が長いほど緊急、次にスコア
        let priority = score;
        if (isFollowUp) {
          const h = r.hours_elapsed ?? 0;
          priority += h >= 72 ? 50 : h >= 48 ? 30 : 20;
        }
        if (noNextAction) priority += 10;
        if (isLineNew)    priority += 5;

        // 最適テンプレートを1件選択して名前を差し込む
        const displayName = r.display_name ?? r.name;
        const recommended = getRecommendedTemplates(
          {
            category:    r.category ?? undefined,
            status:      r.status,
            tags,
            temperature: r.temperature,
            line_user_id: r.line_user_id ?? undefined,
          },
          1,
        );
        const rawBody = recommended[0]?.body ?? null;
        const bestTemplate = rawBody
          ? (rawBody.includes(displayName) || rawBody.startsWith("さん")
              ? rawBody
              : `${displayName}さん、\n${rawBody}`)
          : null;

        return {
          id:           r.id,
          name:         r.name,
          display_name: displayName,
          score,
          scoreLabel:   label,
          scoreReasons: reasons,
          queueReasons,
          next_action:  r.next_action,
          line_user_id: r.line_user_id,
          status:       r.status,
          temperature:  r.temperature,
          hoursElapsed: r.hours_elapsed,
          priority,
          bestTemplate,
        } satisfies ChaseQueueItem;
      })
      .filter((item): item is ChaseQueueItem => item !== null)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  } catch (e) {
    console.error("[getChaseQueue]", e);
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
