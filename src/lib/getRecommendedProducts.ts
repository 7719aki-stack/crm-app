import { OFFER_PRODUCTS, type OfferProduct } from "./products";

// ─── 顧客コンテキスト ────────────────────────────────────
export type CustomerContext = {
  tags: string[];
  funnel_stage?: number;
  purchases?: Array<{ product_id: string }>;
  category?: string;
  temperature?: string;
};

// ─── 顧客フェーズ ────────────────────────────────────────
export type CustomerPhase = "cold" | "warm" | "hot";

// ─── タグ部分一致ヘルパー ────────────────────────────────
function hasTag(tags: string[], ...keywords: string[]): boolean {
  return keywords.some((kw) => tags.some((t) => t === kw || t.includes(kw)));
}

// ─── フェーズ判定 ────────────────────────────────────────
// hot  : リピーター / 有料購入済み / purchases あり / funnel_stage ≥ 3
// warm : 有料興味あり / 無料鑑定済み / funnel_stage ≥ 2
// cold : それ以外（初期・初回）
export function resolvePhase(ctx: CustomerContext): CustomerPhase {
  const { tags, funnel_stage = 1, purchases = [] } = ctx;

  const isRepeater  = hasTag(tags, "リピーター");
  const hasPaid     = hasTag(tags, "有料購入", "有料鑑定済み");
  const hasPurchase = purchases.length > 0;

  if (isRepeater || hasPaid || hasPurchase || funnel_stage >= 3) return "hot";

  const wantsAction = hasTag(tags, "有料興味あり");
  const freeDone    = hasTag(tags, "無料鑑定済み");

  if (wantsAction || freeDone || funnel_stage >= 2) return "warm";

  return "cold";
}

// ─── フェーズ × 表示するサブ商品ID ──────────────────────
// スコアリング対象の絞り込みに使う（メイン商品は常に別管理）
const PHASE_SUB_IDS: Record<CustomerPhase, string[]> = {
  cold: ["quick"],
  warm: ["quick", "deep"],
  hot:  ["premium", "fix"],
};

// ─── メイン商品の reason をフェーズで切り替え ────────────
const PHASE_MAIN_REASON: Record<CustomerPhase, string> = {
  cold: "まずは現状を整理したい方に向いています",
  warm: "さらに深く状況を知りたい方におすすめです",
  hot:  "本気で結果を変えたい方への出発点となる鑑定です",
};

// ─── サブ商品の reason フォールバック（スコア理由がない場合）
const PHASE_SUB_FALLBACK: Record<CustomerPhase, string> = {
  cold: "まずは現状を整理したい方に向いています",
  warm: "さらに深く状況を知りたい方におすすめです",
  hot:  "本気で結果を変えたい方へのコースです",
};

// ─── 既知のサブ商品ID（カスタムプリセット判定に使用）──────
const KNOWN_SUB_IDS = new Set(["quick", "deep", "fix", "premium"]);

// ─── 並び順微調整用スコアリング ──────────────────────────
type ScoreResult = { score: number; reason: string };

function scoreProduct(
  product: OfferProduct,
  ctx: CustomerContext,
): ScoreResult {
  const {
    tags,
    funnel_stage = 1,
    purchases = [],
    category = "",
  } = ctx;

  const isRepeater    = hasTag(tags, "リピーター");
  const hasPaid       = hasTag(tags, "有料購入", "有料鑑定済み");
  const wantsAction   = hasTag(tags, "有料興味あり");
  const purchaseCount = purchases.length;

  const hits: Array<{ score: number; reason: string }> = [];

  // ── 恋愛逆転アクション設計（quick / ¥9,800） ────────────
  if (product.id === "quick") {
    if (hasTag(tags, "片思い・進展", "片思い"))
      hits.push({ score: 50, reason: "片思いや進展が止まっている方に最適です" });
    if (category === "片思い" && hits.length === 0)
      hits.push({ score: 35, reason: "片思いを具体的に動かしたい方に向いています" });
    if (wantsAction)
      hits.push({ score: 20, reason: "すぐ行動を起こしたい方におすすめです" });
    if (hasTag(tags, "無料鑑定済み") && !hasPaid)
      hits.push({ score: 15, reason: "無料鑑定の次のステップとして最適です" });
  }

  // ── 深層心理完全解析（deep / ¥19,800） ──────────────────
  if (product.id === "deep") {
    if (hasTag(tags, "不倫・複雑愛", "不倫", "複雑"))
      hits.push({ score: 50, reason: "複雑な関係を深く整理したい方におすすめです" });
    if (hasTag(tags, "復縁"))
      hits.push({ score: 45, reason: "復縁の流れを具体的に見たい方におすすめです" });
    if (category === "不倫" || category === "複雑系")
      hits.push({ score: 35, reason: "複雑な関係を深く整理したい方におすすめです" });
    if (category === "復縁" && !hasTag(tags, "復縁"))
      hits.push({ score: 30, reason: "復縁の流れを具体的に見たい方におすすめです" });
    if (hasPaid)    hits.push({ score: 20, reason: "" });
    if (isRepeater) hits.push({ score: 15, reason: "" });
  }

  // ── 運命修正プログラム（fix / ¥29,800） ─────────────────
  if (product.id === "fix") {
    if (hasTag(tags, "不倫・複雑愛", "不倫", "複雑"))
      hits.push({ score: 50, reason: "複雑な関係を根本から変えたい方に向いています" });
    if (hasTag(tags, "復縁"))
      hits.push({ score: 40, reason: "復縁を本気で目指している方におすすめです" });
    if (isRepeater)
      hits.push({ score: 30, reason: "すでに鑑定済みで次の一手が必要な方に最適です" });
    if (funnel_stage >= 3)  hits.push({ score: 20, reason: "" });
    if (purchaseCount >= 1) hits.push({ score: 10, reason: "" });
  }

  // ── 完全逆転プログラム（premium / ¥49,800） ──────────────
  if (product.id === "premium") {
    if (hasTag(tags, "復縁"))
      hits.push({ score: 45, reason: "復縁を確実に実現したい方の最上位コースです" });
    if (isRepeater)
      hits.push({ score: 40, reason: "すでに動き始めていて本気で逆転したい方のコースです" });
    if (funnel_stage >= 3)       hits.push({ score: 25, reason: "" });
    if (purchaseCount >= 2)      hits.push({ score: 20, reason: "" });
    if (ctx.temperature === "hot") hits.push({ score: 15, reason: "" });
  }

  // ── カスタムプリセット対応（recommendedTags フォールバック）
  if (!KNOWN_SUB_IDS.has(product.id) && product.recommendedTags) {
    const tagMatch = product.recommendedTags.some((rt) => hasTag(tags, rt));
    if (tagMatch) hits.push({ score: 20, reason: product.reason ?? "" });
  }

  const totalScore = hits.reduce((sum, h) => sum + h.score, 0);
  const topReason  =
    hits
      .filter((h) => h.reason)
      .sort((a, b) => b.score - a.score)[0]?.reason ?? "";

  return { score: totalScore, reason: topReason };
}

// ─── メイン関数 ─────────────────────────────────────────
export function getRecommendedProducts(
  ctx: CustomerContext,
  presets?: OfferProduct[],
): OfferProduct[] {
  const catalog = presets ?? OFFER_PRODUCTS;
  const phase   = resolvePhase(ctx);

  // メイン商品：フェーズ別 reason を付与して固定先頭
  const rawMain = catalog.find((p) => p.type === "main");
  const main    = rawMain
    ? { ...rawMain, reason: PHASE_MAIN_REASON[phase] }
    : undefined;

  // タグなし → メインのみ
  if (!ctx.tags || ctx.tags.length === 0) {
    return main ? [main] : [];
  }

  const phaseIds = PHASE_SUB_IDS[phase];

  // サブ商品をフェーズでフィルタ → スコアで並び替え
  const rankedSubs = catalog
    .filter((p) => {
      if (p.type === "main") return false;
      // 既知商品：フェーズ指定のIDのみ
      if (KNOWN_SUB_IDS.has(p.id)) return phaseIds.includes(p.id);
      // カスタムプリセット：recommendedTags マッチで判断
      return p.recommendedTags?.some((rt) => hasTag(ctx.tags, rt)) ?? false;
    })
    .map((p) => {
      const { score, reason } = scoreProduct(p, ctx);
      // reason の優先度: スコア理由 > 商品静的 reason > フェーズ汎用フォールバック
      const finalReason = reason || p.reason || PHASE_SUB_FALLBACK[phase];
      return { product: { ...p, reason: finalReason }, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((r) => r.product);

  return [...(main ? [main] : []), ...rankedSubs];
}
