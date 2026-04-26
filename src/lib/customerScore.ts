// ── 成約見込みスコアリング ─────────────────────────────────────
// スコアは 0〜100 点。ステータス・温度感・活動履歴などを軸に算出。
// messages 未渡し時は last_contact を代理値として使用（一覧表示向け）。

export type CustomerScoreInput = {
  status:        string;
  temperature:   string;
  tags:          string[];
  line_user_id?: string | null;
  next_action?:  string | null;
  consultation?: string;
  last_contact?: string;   // YYYY-MM-DD（一覧時の代理活動日）
  crisis_level?: number;
};

export type MessageSummary = {
  direction:  "inbound" | "outbound";
  created_at: string;
  source?:    string;
};

export type CustomerScoreBreakdown = {
  score:   number;         // 0〜100
  label:   "高" | "中" | "低";
  reasons: string[];       // 3〜5件の理由ラベル
};

// ── ステータス別ベーススコア（最大 30）────────────────────────
const STATUS_SCORE: Record<string, number> = {
  paid_purchased:          30,
  deep_guided:             27,
  destiny_proposed:        25,
  reversal_proposed:       24,
  deep_psych_proposed:     23,
  full_reversal_sounded:   21,
  full_reversal_purchased: 19,
  free_sent:               16,
  info_received:           14,
  divination_guided:       12,
  educating:               9,
  new_reg:                 5,
  dormant:                 2,
  churned:                 0,
};

// ── 温度感スコア（最大 20）────────────────────────────────────
const TEMP_SCORE: Record<string, number> = {
  hot:  20,
  warm: 14,
  cool: 7,
  cold: 2,
};

// 高価値タグ（購入・リピーター実績）
const HIGH_VALUE_TAGS = new Set(["有料購入", "リピーター", "有料鑑定済み"]);

// 強い悩みキーワード
const STRONG_CONCERN_RE = /不安|辛|怖|悩|苦し|孤独|寂し|別れ|消えたい|消えた/;

export function calculateCustomerScore(
  customer: CustomerScoreInput,
  messages: MessageSummary[] = [],
): CustomerScoreBreakdown {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();

  // ── 1. ステータス（0〜30）─────────────────────────────────
  const statusPts = STATUS_SCORE[customer.status] ?? 4;
  score += statusPts;
  if (statusPts >= 25) {
    reasons.push("有料転換済み / アップセル段階");
  } else if (statusPts >= 16) {
    reasons.push("鑑定フロー進行中");
  } else if (statusPts >= 9) {
    reasons.push("リード教育段階");
  }

  // ── 2. 温度感（0〜20）────────────────────────────────────
  const tempPts = TEMP_SCORE[customer.temperature] ?? 5;
  score += tempPts;
  if (tempPts >= 14) reasons.push("温度感が高い");

  // ── 3. LINE接続（0〜10）──────────────────────────────────
  if (customer.line_user_id) {
    score += 10;
    reasons.push("LINE接続済み");
  }

  // ── 4. 活動履歴（0〜15）──────────────────────────────────
  if (messages.length > 0) {
    const lastOut = [...messages].reverse().find((m) => m.direction === "outbound");
    const lastIn  = [...messages].reverse().find((m) => m.direction === "inbound");

    if (lastOut) {
      const daysAgo = (now.getTime() - new Date(lastOut.created_at).getTime()) / 86400000;
      if (daysAgo <= 7) {
        score += 8;
        reasons.push("最近送信あり");
      } else if (daysAgo <= 30) {
        score += 4;
      }
    }

    if (lastIn) {
      const daysAgo = (now.getTime() - new Date(lastIn.created_at).getTime()) / 86400000;
      if (daysAgo <= 7) {
        score += 7;
        reasons.push("最近返信あり");
      } else if (daysAgo <= 30) {
        score += 3;
      }
    }
  } else if (customer.last_contact) {
    // messages なし → last_contact を代理値として使用
    const daysAgo = (now.getTime() - new Date(customer.last_contact).getTime()) / 86400000;
    if (daysAgo <= 7) {
      score += 10;
      reasons.push("直近に接触あり");
    } else if (daysAgo <= 30) {
      score += 5;
    }
  }

  // ── 5. 返信速度（0〜10）──────────────────────────────────
  if (messages.length >= 2) {
    const outbound = messages.filter((m) => m.direction === "outbound");
    const inbound  = messages.filter((m) => m.direction === "inbound");
    const lastSent = outbound[outbound.length - 1];
    const lastRecv = inbound[inbound.length - 1];

    if (lastSent && lastRecv) {
      const sentAt = new Date(lastSent.created_at).getTime();
      const recvAt = new Date(lastRecv.created_at).getTime();
      if (recvAt > sentAt) {
        const gapH = (recvAt - sentAt) / 3600000;
        if (gapH <= 6)  { score += 10; reasons.push("返信が早い（6h以内）"); }
        else if (gapH <= 24) { score += 7;  reasons.push("返信間隔が短い"); }
        else if (gapH <= 72) { score += 4; }
      }
    }
  }

  // ── 6. 高価値タグ（0〜5）────────────────────────────────
  if (customer.tags.some((t) => HIGH_VALUE_TAGS.has(t))) {
    score += 5;
    reasons.push("有料購入実績あり");
  }

  // ── 7. 相談内容キーワード（0〜5）────────────────────────
  if (customer.consultation && STRONG_CONCERN_RE.test(customer.consultation)) {
    score += 5;
    reasons.push("強い悩みあり");
  }

  // ── 8. 次回アクション設定（0〜5）────────────────────────
  if (customer.next_action) {
    score += 5;
    reasons.push("次回アクション設定済み");
  }

  // ── 9. ペナルティ ─────────────────────────────────────────
  if (customer.status === "churned") {
    score -= 10;
    if (!reasons.find((r) => r.includes("離脱"))) reasons.push("離脱ステータス");
  } else if (customer.status === "dormant") {
    score -= 5;
    reasons.push("休眠中");
  }

  // フォロー対象（24h超・返信なし）ペナルティ
  if (messages.length > 0) {
    const lastOut = [...messages].reverse().find((m) => m.direction === "outbound");
    const lastIn  = [...messages].reverse().find((m) => m.direction === "inbound");
    if (lastOut) {
      const sentAt = new Date(lastOut.created_at).getTime();
      const hoursSinceSent = (now.getTime() - sentAt) / 3600000;
      const hasReplyAfter = lastIn && new Date(lastIn.created_at).getTime() > sentAt;
      if (hoursSinceSent >= 72 && !hasReplyAfter) {
        score -= 5;
      }
    }
  }

  // 長期無接触ペナルティ（last_contact > 60日）
  if (customer.last_contact) {
    const daysAgo = (now.getTime() - new Date(customer.last_contact).getTime()) / 86400000;
    if (daysAgo > 60) score -= 5;
  }

  // ── クランプ & ラベル ─────────────────────────────────────
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const label: "高" | "中" | "低" =
    finalScore >= 80 ? "高" :
    finalScore >= 50 ? "中" : "低";

  // reasons を最大5件に絞り、重複を除去
  const seen = new Set<string>();
  const dedupedReasons: string[] = [];
  for (const r of reasons) {
    if (!seen.has(r)) { seen.add(r); dedupedReasons.push(r); }
    if (dedupedReasons.length >= 5) break;
  }

  // reasons が少なければ補充
  if (dedupedReasons.length === 0) {
    if (finalScore < 20) dedupedReasons.push("活動が少ない");
    else dedupedReasons.push("標準的な状態");
  }

  return { score: finalScore, label, reasons: dedupedReasons };
}

// ラベル表示用スタイル
export const SCORE_LABEL_STYLE: Record<"高" | "中" | "低", string> = {
  高: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  中: "bg-amber-100  text-amber-700  border border-amber-200",
  低: "bg-gray-100   text-gray-500   border border-gray-200",
};

export const SCORE_BAR_COLOR: Record<"高" | "中" | "低", string> = {
  高: "bg-emerald-500",
  中: "bg-amber-400",
  低: "bg-gray-300",
};
