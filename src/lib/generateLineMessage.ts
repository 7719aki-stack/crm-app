// ─── フェーズ連動 LINE 文生成 ────────────────────────────────────────────────
// phase / tags / productName から送信用 LINE 文章を組み立てる。
// AI は使わずローカルのパーツ定義から生成する。

import type { CustomerPhase } from "./getRecommendedProducts";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface GenerateLineMessageOptions {
  phase:        CustomerPhase;
  tags:         string[];
  productName?: string;
}

// ── タグ別共感文 ──────────────────────────────────────────────────────────────

const EMPATHY_BY_TAG: { tags: string[]; texts: string[] }[] = [
  {
    tags: ["復縁"],
    texts: [
      "ここまで気持ちを持ち続けてきたこと、本当につらかったと思います。",
      "簡単に割り切れないから、こんなに悩んでいるんですよね。\nその気持ち、ちゃんと受け止めています。",
      "一人で抱えてきた時間が長かった分、心が消耗しているのが伝わります。",
    ],
  },
  {
    tags: ["片思い・連絡", "片思い・進展"],
    texts: [
      "相手の反応が気になって、ずっとスマホを見てしまいますよね。\nそういう日々、本当に疲れてしまいますよね。",
      "少しの変化でも一喜一憂してしまう、\nそれだけ相手のことを大切に思っているんですね。",
      "好きな気持ちを抑えながら毎日過ごしているんですね。\nそれはしんどいですよね。",
    ],
  },
  {
    tags: ["不倫・複雑愛"],
    texts: [
      "周りには話せないからこそ、一人で抱えてきた重さ、どれほどだったか……。",
      "誰にも言えないこと、ここで話してくださってありがとうございます。",
      "複雑な気持ちを言葉にするのも難しいですよね。ゆっくりでいいですよ。",
    ],
  },
  {
    tags: ["人間関係・仕事"],
    texts: [
      "毎日関わる相手だからこそ、うまくいかないときの消耗は倍になりますよね。",
      "仕事の悩みは、休んでも頭から離れにくいですよね。\nずっと抱えてきたんですね。",
      "誰かに話したくても、職場では言えないことが多いですよね。\nここで話してください。",
    ],
  },
  {
    tags: ["金運・開運"],
    texts: [
      "流れを変えるタイミングが来ているのに、なかなか動き出せないですよね。",
      "お金の不安って、毎日じわじわ積み重なっていくものですよね。",
    ],
  },
  {
    tags: ["健康"],
    texts: [
      "体のことは後回しにしてしまいがちですよね。\n気にかけてくださっていてよかったです。",
      "不安が続くと精神的にも疲れてきますよね。\nまずはゆっくりお話ししましょう。",
    ],
  },
];

const EMPATHY_DEFAULT = [
  "一人で考えていると、答えが見えにくくなりますよね。\nゆっくりお話ししていきましょう。",
  "その気持ち、ちゃんと受け止めています。\n話してくれてよかったです。",
  "抱えていたものを話してくれてよかったです。\n一緒に考えていきましょう。",
];

// ── フェーズ別テンプレート ────────────────────────────────────────────────────

const PHASE_BODY: Record<CustomerPhase, { situation: string; offer: string; action: string }[]> = {
  cold: [
    {
      situation: "今の状況を整理することで、これからの動きが見えてきます。",
      offer:     "必要であれば、\n{product}で詳しく確認することもできます。",
      action:    "気になる場合だけ教えてくださいね。",
    },
    {
      situation: "まずは今どこにいるかを一緒に整理していきましょう。",
      offer:     "必要であれば、\n{product}で丁寧に確認することができます。",
      action:    "よかったらそのまま返してくださいね。",
    },
  ],
  warm: [
    {
      situation: "このまま進んだ場合どうなるか、一度しっかり確認しておくことをおすすめしています。",
      offer:     "必要であれば、\n{product}でより詳しく視ることができます。",
      action:    "気になる場合はそのまま返してくださいね。",
    },
    {
      situation: "今の流れを確認しておくことで、次の一手がはっきり見えてきます。",
      offer:     "必要であれば、\n{product}で詳しく整理することもできます。",
      action:    "気になった場合だけ教えてください。",
    },
  ],
  hot: [
    {
      situation: "今が動き時だと感じています。\nここで一歩進むことで、流れが変わってきます。",
      offer:     "{product}で具体的にご案内できます。",
      action:    "よかったらそのまま返してください。",
    },
    {
      situation: "ここから先の動き方が、これからの結果を大きく左右します。",
      offer:     "{product}でより具体的な方向性をお伝えできます。",
      action:    "ぜひ一緒に進めていきましょう。",
    },
  ],
};

// ── ユーティリティ ────────────────────────────────────────────────────────────

function pickEmpathy(tags: string[]): string {
  for (const entry of EMPATHY_BY_TAG) {
    if (entry.tags.some((t) => tags.includes(t))) {
      return pickRandom(entry.texts);
    }
  }
  return pickRandom(EMPATHY_DEFAULT);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillProduct(template: string, productName: string): string {
  return template.replace("{product}", productName);
}

// ── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * フェーズ × タグ × 商品名 から LINE 送信用の文章を生成する。
 * productName が未指定の場合はオファー行を省略する。
 */
export function generateLineMessage({
  phase,
  tags,
  productName,
}: GenerateLineMessageOptions): string {
  const empathy = pickEmpathy(tags);
  const body    = pickRandom(PHASE_BODY[phase]);

  const parts: string[] = [empathy, "", body.situation];

  if (productName) {
    parts.push("", fillProduct(body.offer, productName));
  }

  parts.push("", body.action);

  return parts.join("\n");
}
