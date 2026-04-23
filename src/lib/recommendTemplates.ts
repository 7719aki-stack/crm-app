import { TEMPLATES, type Template } from "./messageTemplates";

// ── 顧客コンテキスト型（LineSendTemplatePanel / LineSendPanel で共有） ──
export type CustomerContext = {
  category?:    string;
  status?:      string;
  tags?:        string[];
  temperature?: string;
  line_user_id?: string;
  funnel_stage?: number;
  consultation?: string;
};

export type ScoredTemplate = Template & {
  score:       number;
  reasonLabel: string;
};

// purpose → 表示ラベル
const PURPOSE_LABEL: Record<string, string> = {
  共感: "共感向き",
  信頼: "信頼構築向き",
  誘導: "状況確認向き",
  販売: "有料案内向き",
};

// 特定の顧客コンテキストに対して各テンプレートをスコアリングし
// 上位 maxCount 件を返す。スコアが足りない場合はフォールバックを補充。
export function getRecommendedTemplates(
  customer: CustomerContext,
  maxCount = 7,
): ScoredTemplate[] {
  type Candidate = { template: Template; score: number; reasonLabel: string };

  const candidates: Candidate[] = TEMPLATES.map((t) => {
    let score = 0;
    const reasons: string[] = [];
    const rf = t.recommendedFor;

    if (rf) {
      if (rf.categories?.includes(customer.category ?? "")) {
        score += 3;
        reasons.push("カテゴリ一致");
      }
      if (rf.statuses?.includes(customer.status ?? "")) {
        score += 3;
        reasons.push("状況一致");
      }
      if (customer.tags?.some((tag) => rf.tags?.includes(tag))) {
        score += 2;
        reasons.push("タグ一致");
      }
      if (rf.temperatures?.includes(customer.temperature ?? "")) {
        score += 1;
        reasons.push("温度感一致");
      }
      if (customer.funnel_stage != null && rf.funnel_stages?.includes(customer.funnel_stage)) {
        score += 1;
        reasons.push("フェーズ一致");
      }
    }

    // LINE ID未設定時は販売テンプレを少し下げる
    if (!customer.line_user_id && t.purpose === "販売") {
      score -= 1;
    }

    // 相談内容の簡易キーワードマッチ（共感テンプレの優先度UP）
    if (customer.consultation && t.purpose === "共感") {
      if (/不安|辛|怖|悩|苦し|孤独|寂し/.test(customer.consultation)) {
        score += 1;
        if (!reasons.length) reasons.push("相談内容に対応");
      }
    }

    return {
      template:    t,
      score,
      reasonLabel: reasons[0] ?? PURPOSE_LABEL[t.purpose] ?? "",
    };
  });

  const positive = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const result = positive.slice(0, maxCount);

  // スコアが5件未満の場合はフォールバック（ purpose ラベルで補充）
  if (result.length < 5) {
    const needed = 5 - result.length;
    const fallback = candidates
      .filter((c) => c.score <= 0)
      .slice(0, needed)
      .map((c) => ({
        ...c,
        score: 0,
        reasonLabel: PURPOSE_LABEL[c.template.purpose] ?? "",
      }));
    result.push(...fallback);
  }

  return result.map(({ template, score, reasonLabel }) => ({
    ...template,
    score,
    reasonLabel,
  }));
}
