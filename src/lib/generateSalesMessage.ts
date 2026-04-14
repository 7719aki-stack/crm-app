// ─── 提案文生成（Step 4-6）───────────────────────────────────
// 「商品名を前面に出さない」ソフトな案内文を生成する純粋関数。
// 用途：鑑定後に自然な流れで次のサービスを案内する補助テンプレ。
// ルール：売り込み禁止 / 一文は短め / 改行でスマホ最適化 / 商品は1つだけ

import { getRecommendedProducts } from "./getRecommendedProducts";

// ── タグ別の導入一言（手動鑑定の後に続けて使う想定） ──────────

const BRIDGE: { tags: string[]; text: string }[] = [
  {
    tags: ["復縁"],
    text: "気持ちの整理がついてきたら、\n次の動き方も一緒に見ていけます。",
  },
  {
    tags: ["片思い・進展"],
    text: "もう少し踏み込んで見たい場合は、\n次のステップもご案内できます。",
  },
  {
    tags: ["不倫・複雑愛"],
    text: "この先どう動くか整理したい場合は、\nもう少し詳しく見ることもできます。",
  },
  {
    tags: ["人間関係・仕事"],
    text: "具体的な動き方まで知りたい場合は、\n詳しくお伝えすることもできます。",
  },
  {
    tags: ["金運・開運"],
    text: "流れをしっかり変えていきたい場合は、\nもう少し深く見ることもできます。",
  },
];

const DEFAULT_BRIDGE =
  "もう少し詳しく知りたい場合は、\nご案内できることがあります。";

// ── タグ別のソフトな商品案内フレーズ ──────────────────────────

function buildOffer(tags: string[]): string {
  if (tags.includes("復縁")) {
    return "この先の関係の流れや\n相手の気持ちを深く見たい方向けのメニューがあります。";
  }
  if (tags.includes("不倫・複雑愛")) {
    return "複雑な関係をどう整理するか\n一緒に見ていけるメニューがあります。";
  }
  if (tags.includes("片思い・進展")) {
    return "次の一手と距離感を\n丁寧に整理できるメニューがあります。";
  }
  return "今後の流れをもう少し丁寧に\n見ていけるメニューがあります。";
}

// ── ユーティリティ ──────────────────────────────────────────────

function pick<T extends { tags: string[] }>(
  list: T[],
  tags: string[]
): T | undefined {
  return list.find((item) => item.tags.some((t) => tags.includes(t)));
}

// ── メイン関数 ──────────────────────────────────────────────────

export function generateSalesMessage(
  tags: string[],
  _concern?: string
): string {
  // 商品は存在確認のみ（名前は前面に出さない）
  const products = getRecommendedProducts({ tags });
  const hasUpsell = products.some((p) => p.type === "upsell");

  const bridge = pick(BRIDGE, tags)?.text ?? DEFAULT_BRIDGE;
  const offer = hasUpsell ? buildOffer(tags) : "";
  const action = "気になる場合は、\nそのまま教えていただければご案内します。";

  return [bridge, ...(offer ? [offer] : []), action].join("\n\n");
}
