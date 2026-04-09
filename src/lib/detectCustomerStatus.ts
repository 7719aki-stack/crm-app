// ─── LINE受信メッセージからの顧客ステータス自動判定 ──────────
// 受信テキストと現在のステータスを受け取り、
// 「昇格のみ」のルールで新しいステータスを返す。
// 降格・横移動は行わない。離脱・休眠は自動変更対象外。

import type { StatusId } from "./statuses";

// ── ステータス昇格ランク（数値が大きいほど上流） ──────────
// dormant / churned は自動昇格対象外なので 0 に設定
const STATUS_RANK: Record<StatusId, number> = {
  new_reg:                 1,
  educating:               2,
  divination_guided:       3,
  info_received:           4,
  free_sent:               5,
  deep_guided:             6,
  paid_purchased:          7,
  destiny_proposed:        8,
  reversal_proposed:       9,
  deep_psych_proposed:     10,
  full_reversal_sounded:   11,
  full_reversal_purchased: 12,
  dormant:                 0,
  churned:                 0,
};

interface StatusRule {
  keywords: string[];
  target:   StatusId;
}

// ── 判定ルール（優先度順：上ほど高優先） ──────────────────
const STATUS_RULES: StatusRule[] = [
  // 有料購入（最高優先）
  {
    keywords: [
      "購入しました", "決済しました", "支払いました",
      "購入完了", "決済完了", "お支払いしました",
    ],
    target: "paid_purchased",
  },
  // アップセル興味（深層誘導）
  {
    keywords: ["詳しく知りたい", "気になる", "受けたい", "お願いしたい"],
    target: "deep_guided",
  },
  // 鑑定リクエスト（最低優先）
  {
    keywords: ["鑑定", "相談", "見てほしい", "お願いします"],
    target: "divination_guided",
  },
];

/**
 * 受信テキストと現在のステータスから、昇格後のステータスを返す。
 * 昇格しない場合（現状維持でよい場合）は null を返す。
 */
export function detectCustomerStatus(
  text:          string,
  currentStatus: StatusId,
): StatusId | null {
  // 離脱・休眠は自動更新対象外
  if (currentStatus === "dormant" || currentStatus === "churned") return null;

  const currentRank = STATUS_RANK[currentStatus] ?? 1;
  let bestTarget: StatusId | null = null;
  let bestRank = currentRank;

  for (const rule of STATUS_RULES) {
    if (!rule.keywords.some((kw) => text.includes(kw))) continue;
    const targetRank = STATUS_RANK[rule.target] ?? 0;
    // 現在より上のランクにのみ昇格する
    if (targetRank > bestRank) {
      bestRank   = targetRank;
      bestTarget = rule.target;
    }
  }

  return bestTarget;
}
