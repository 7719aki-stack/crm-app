// ─── 商品案内自然文生成（Step 4-7）──────────────────────────
// 鑑定文の後ろにそのまま貼れる、売り込まない短文テンプレを生成する。
// ルール：商品1つだけ / 「必要であれば」必須 / 「気になる場合だけ」必須

import { getRecommendedProducts } from "./getRecommendedProducts";

// ── タグ別の前置き ──────────────────────────────────────────────

const INTRO: { tags: string[]; text: string }[] = [
  {
    tags: ["復縁"],
    text: "ここからの動き方がとても重要になるので、",
  },
  {
    tags: ["不倫・複雑愛"],
    text: "慎重に進める必要がある状況なので、",
  },
  {
    tags: ["片思い・進展"],
    text: "今の距離感が大事な時期なので、",
  },
  {
    tags: ["人間関係・仕事"],
    text: "環境の影響が出やすい時期なので、",
  },
  {
    tags: ["金運・開運"],
    text: "流れを変えるタイミングが来ているので、",
  },
];

const DEFAULT_INTRO = "ここから先の流れも大切なので、";

function pickIntro(tags: string[]): string {
  return (
    INTRO.find((item) => item.tags.some((t) => tags.includes(t)))?.text ??
    DEFAULT_INTRO
  );
}

// ── メイン関数 ──────────────────────────────────────────────────

export function generateOfferMessage(tags: string[]): string {
  const products = getRecommendedProducts(tags);

  // タグに合ったアップセル商品を優先、なければメイン商品
  const product =
    products.find((p) => p.type === "upsell") ?? products[0];

  if (!product) return "";

  const intro = pickIntro(tags);
  const offer = `${product.name}で詳しく整理することもできます。`;
  const action = "気になる場合だけ教えてくださいね。";

  return [
    intro,
    "",
    "必要であれば、",
    offer,
    "",
    action,
  ].join("\n");
}
