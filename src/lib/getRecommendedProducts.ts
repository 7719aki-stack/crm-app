import { OFFER_PRODUCTS, type OfferProduct } from "./products";

// ─── 顧客コンテキスト ────────────────────────────────────
export type CustomerContext = {
  tags: string[];
  funnel_stage?: number;
  purchases?: Array<{ product_id: string }>;
  category?: string;
  temperature?: string;
};

// ─── タグ部分一致ヘルパー ────────────────────────────────
// "片思い・進展" ⊇ "片思い" のように、tagが keywordを含む場合もマッチ
function hasTag(tags: string[], ...keywords: string[]): boolean {
  return keywords.some((kw) => tags.some((t) => t === kw || t.includes(kw)));
}

// ─── 商品スコアリング ────────────────────────────────────
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
    temperature = "cool",
  } = ctx;

  const isRepeater   = hasTag(tags, "リピーター");
  const hasPaid      = hasTag(tags, "有料購入", "有料鑑定済み");
  const wantsAction  = hasTag(tags, "有料興味あり");
  const purchaseCount = purchases.length;

  // { score, reason } の候補リスト。最終的に最高スコアの reason を採用する
  const hits: Array<{ score: number; reason: string }> = [];

  // ── 恋愛逆転アクション設計（quick / ¥9,800） ──────────
  if (product.id === "quick") {
    if (hasTag(tags, "片思い・進展", "片思い"))
      hits.push({ score: 50, reason: "片思いや進展が止まっている方に最適です" });
    if (category === "片思い" && hits.length === 0)
      hits.push({ score: 35, reason: "片思いを具体的に動かしたい方に向いています" });
    if (wantsAction)
      hits.push({ score: 20, reason: "すぐ行動を起こしたい方におすすめです" });
    if (hasTag(tags, "無料鑑定済み") && !hasPaid)
      hits.push({ score: 15, reason: "無料鑑定の次のステップとして最適です" });
    // リピーター・購入済みには上位商品が合うので減点
    if (isRepeater) hits.push({ score: -25, reason: "" });
    if (hasPaid)    hits.push({ score: -15, reason: "" });
  }

  // ── 深層心理完全解析（deep / ¥19,800） ──────────────
  if (product.id === "deep") {
    if (hasTag(tags, "不倫・複雑愛", "不倫", "複雑"))
      hits.push({ score: 50, reason: "複雑な関係を深く整理したい方におすすめです" });
    if (hasTag(tags, "復縁"))
      hits.push({ score: 45, reason: "復縁の流れを具体的に見たい方におすすめです" });
    if (category === "不倫" || category === "複雑系")
      hits.push({ score: 35, reason: "複雑な関係を深く整理したい方におすすめです" });
    if (category === "復縁" && !hasTag(tags, "復縁"))
      hits.push({ score: 30, reason: "復縁の流れを具体的に見たい方におすすめです" });
    if (hasPaid)     hits.push({ score: 20, reason: "" });
    if (isRepeater)  hits.push({ score: 15, reason: "" });
  }

  // ── 運命修正プログラム（fix / ¥29,800） ─────────────
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

  // ── 完全逆転プログラム（premium / ¥49,800） ──────────
  if (product.id === "premium") {
    if (hasTag(tags, "復縁"))
      hits.push({ score: 45, reason: "復縁を確実に実現したい方の最上位コースです" });
    if (isRepeater)
      hits.push({ score: 40, reason: "すでに動き始めていて本気で逆転したい方のコースです" });
    if (funnel_stage >= 3)   hits.push({ score: 25, reason: "" });
    if (purchaseCount >= 2)  hits.push({ score: 20, reason: "" });
    if (temperature === "hot") hits.push({ score: 15, reason: "" });
  }

  // ── 上記にマッチしない商品（カスタムプリセット対応） ──
  if (hits.length === 0 && product.recommendedTags) {
    const tagMatch = product.recommendedTags.some((rt) => hasTag(tags, rt));
    if (tagMatch)
      hits.push({ score: 20, reason: product.reason ?? "" });
  }

  const totalScore = hits.reduce((sum, h) => sum + h.score, 0);
  // reason は最も高スコアのものを採用（空文字は除外）
  const topReason =
    hits
      .filter((h) => h.reason)
      .sort((a, b) => b.score - a.score)[0]?.reason ??
    product.reason ??
    "";

  return { score: totalScore, reason: topReason };
}

// ─── メイン関数 ─────────────────────────────────────────
export function getRecommendedProducts(
  ctx: CustomerContext,
  presets?: OfferProduct[],
): OfferProduct[] {
  const catalog = presets ?? OFFER_PRODUCTS;

  // メイン商品は常に先頭に固定
  const main = catalog.find((p) => p.type === "main");
  const subs = catalog.filter((p) => p.type !== "main");

  // タグが何もなければメイン商品のみ
  if (!ctx.tags || ctx.tags.length === 0) {
    return main ? [main] : [];
  }

  // サブ商品をスコアリング → 正スコアのみ・高スコア順
  const rankedSubs = subs
    .map((p) => {
      const { score, reason } = scoreProduct(p, ctx);
      return { product: { ...p, reason: reason || p.reason }, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.product);

  return [...(main ? [main] : []), ...rankedSubs];
}
