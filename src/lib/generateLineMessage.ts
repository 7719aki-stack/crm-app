// ─── フェーズ連動 LINE 文生成 ────────────────────────────────────────────────
// phase / tags / productName から送信用 LINE 文章を組み立てる。
// AI は使わずローカルのパーツ定義から生成する。

import type { CustomerPhase } from "./getRecommendedProducts";
import type { ReplyIntent } from "./resolveReplyIntent";

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

// ── 商品別フック文 ────────────────────────────────────────────────────────────
// productName の部分一致で判定し、その商品ならではの「なぜ今これが必要か」を返す。

const PRODUCT_HOOKS: { keywords: string[]; hook: string }[] = [
  {
    keywords: ["逆転アクション"],
    hook: "今の状況を変えるための具体的な一手を、一緒に設計します。",
  },
  {
    keywords: ["深層心理"],
    hook: "相手の深層にある本音と、この関係の核心を読み解きます。",
  },
  {
    keywords: ["運命修正"],
    hook: "今の流れそのものを変えるための、根本からのアプローチです。",
  },
  {
    keywords: ["完全逆転"],
    hook: "この関係を根本から逆転させる、最上位の鑑定プログラムです。",
  },
  {
    keywords: ["深層恋愛鑑定", "恋愛鑑定"],
    hook: "今の感情の流れと相手の本音を、鑑定で丁寧に読み解きます。",
  },
];

const PRODUCT_HOOK_DEFAULT =
  "今の状況をより深く整理するための、一歩進んだ鑑定です。";

/**
 * 商品名から対応するフック文を返す。
 * productName が未指定、またはどのキーワードにも一致しない場合はデフォルト文を返す。
 */
export function resolveProductHook(productName?: string): string {
  if (!productName) return PRODUCT_HOOK_DEFAULT;
  const entry = PRODUCT_HOOKS.find((e) =>
    e.keywords.some((kw) => productName.includes(kw)),
  );
  return entry?.hook ?? PRODUCT_HOOK_DEFAULT;
}

// ── フェーズ別緊急性メッセージ ────────────────────────────────────────────────
// 煽りすぎず、「今動く理由」を自然に添える一文。

const URGENCY_BY_PHASE: Record<CustomerPhase, string[]> = {
  cold: [
    "今感じている不安は、早めに整理しておくほど動きやすくなります。",
    "タイミングは、自分が思っているより早く過ぎていきます。",
    "今の状態を放っておくと、気持ちが固まる前に流れが変わってしまうことがあります。",
  ],
  warm: [
    "迷っている間にも、状況は少しずつ動いています。",
    "ここで一度立ち止まって確認しておくことで、後の判断がずっとラクになります。",
    "確認できるタイミングは、今が一番いいと感じています。",
  ],
  hot: [
    "今がその「動くべき瞬間」だと感じています。",
    "ここで一歩踏み出すか、また様子を見るかが、これからの流れを分けます。",
    "このまま時間が経つほど、動き出すタイミングが難しくなっていきます。",
  ],
};

/**
 * フェーズに対応した緊急性メッセージをランダムで返す。
 */
export function resolveUrgencyMessage(phase: CustomerPhase): string {
  return pickRandom(URGENCY_BY_PHASE[phase]);
}

// ── フェーズ別選択式CTA ───────────────────────────────────────────────────────
// ①を選べばそのまま成約、②を選んでも返信が来る。どちらも会話を継続させる設計。

const CHOICE_CTA_BY_PHASE: Record<CustomerPhase, string[]> = {
  cold: [
    "①まずは今の状況を整理してみたい\n②もう少し自分で考えてみる\n\nどちらか返してくれると助かります🙏",
    "①不安を整理してみたい\n②今はまだ様子を見たい\n\nどちらか教えてください😊",
    "①今の状態を確認してみたい\n②少し考えてから決めたい\n\nどちらかだけ返してください！",
  ],
  warm: [
    "①詳しく確認してみたい\n②少し考えてから決めたい\n\nどちらか教えてください😊",
    "①このまま進んだ場合の結果を見てみたい\n②もう少し様子を見る\n\nどちらか返してくれると助かります🙏",
    "①一度確認してみたい\n②今は自分で整理したい\n\nどちらかだけ返してください！",
  ],
  hot: [
    "①このまま進めたい\n②もう少し考えたい\n\nどちらか返してくれると助かります🙏",
    "①今すぐ動きたい\n②少し考えてから決める\n\nどちらか教えてください😊",
    "①流れを変えにいきたい\n②まだ迷っている\n\nどちらかだけ返してください！",
  ],
};

/**
 * フェーズに対応した選択式CTAをランダムで返す。
 * LINE文の末尾に配置し、どちらの選択肢を選んでも返信を促す設計。
 */
export function resolveChoiceCTA(phase: CustomerPhase): string {
  return pickRandom(CHOICE_CTA_BY_PHASE[phase]);
}

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
  const empathy    = pickEmpathy(tags);
  const hook       = resolveProductHook(productName);
  const body       = pickRandom(PHASE_BODY[phase]);
  const urgency    = resolveUrgencyMessage(phase);
  const choiceCTA  = resolveChoiceCTA(phase);

  // 構成: 共感 → フック → 状況整理 → 緊急性 → オファー（商品名あり時） → 選択式CTA
  const parts: string[] = [empathy, "", hook, "", body.situation, "", urgency];

  if (productName) {
    parts.push("", fillProduct(body.offer, productName));
  }

  parts.push("", choiceCTA);

  return parts.join("\n");
}

// ── リマインダーメッセージ生成 ────────────────────────────────────────────────
// positive 後に URL 未クリックの場合、24時間後に再送するメッセージを生成する。

/**
 * 決済URLを再送するリマインダーメッセージを生成する。
 * 呼び出し条件: intent === "positive" かつ hasClicked === false かつ 24時間経過
 */
export function sendReminderMessage(paymentUrl: string): string {
  return [
    "念のためもう一度お送りします👇",
    "",
    paymentUrl,
    "",
    "※今の状態を整理しておくと、この先の動きがかなり楽になります",
  ].join("\n");
}

// ── クロージングメッセージ生成 ────────────────────────────────────────────────
// positive 返信に対して「確実に成約に繋げる」専用メッセージを生成する。
// 構成: お礼 → 行動後押し → 限定性/緊急性 → CTA（URL）

const CLOSING_BODY: Record<CustomerPhase, { push: string; urgency?: string }[]> = {
  cold: [
    {
      push: "まずは全体像を整理することから始めていきましょう。",
    },
    {
      push: "今の状況を整理することで、これからの動き方が見えてきます。",
    },
  ],
  warm: [
    {
      push: "ここまで来ているので、判断の精度を上げることが大切です。",
    },
    {
      push: "このまま進んだ場合の結果を確認しておくことで、後の選択がずっとラクになります。",
    },
  ],
  hot: [
    {
      push:    "今が一番流れを変えやすいタイミングです。",
      urgency: "※このタイミングを逃すと、同じ状態が続く可能性があります",
    },
    {
      push:    "ここで動き出せたこと、きっと後から「あのとき動いてよかった」と思えます。",
      urgency: "※今の流れが続く前に、一歩進んでおきましょう",
    },
  ],
};

export interface GenerateClosingMessageOptions {
  phase:        CustomerPhase;
  productName?: string;
  paymentUrl?:  string;
}

/**
 * positive 返信専用のクロージングメッセージを生成する。
 * paymentUrl が渡された場合は URL をそのまま挿入し、ない場合はプレースホルダーを使う。
 */
export function generateClosingMessage({
  phase,
  productName,
  paymentUrl,
}: GenerateClosingMessageOptions): string {
  const body    = pickRandom(CLOSING_BODY[phase]);
  const urlLine = paymentUrl ?? "（※URLをここにご案内します）";
  const ctaLabel = productName
    ? `${productName}の詳細はこちらからご確認ください👇`
    : "詳しい内容はこちらから確認できます👇";

  const parts = [
    "ありがとうございます。",
    body.push,
    "",
    `${ctaLabel}\n${urlLine}`,
  ];

  if (body.urgency) {
    parts.push("", body.urgency);
  }

  return parts.join("\n");
}

// ── フォローアップメッセージ生成 ──────────────────────────────────────────────
// resolveReplyIntent の結果 × フェーズ × 商品名 から次の返信文を生成する。

const FOLLOWUP_POSITIVE: Record<CustomerPhase, string[]> = {
  cold: [
    "ありがとうございます。\n今の状況を整理しながら、丁寧にご案内していきますね。",
    "ありがとうございます。\nまず今どこにいるかを一緒に確認していきましょう。",
  ],
  warm: [
    "ありがとうございます。\nこのまま具体的な内容をご案内しますね。",
    "ありがとうございます。\n確認できるタイミングに動いてくれてよかったです。一緒に進めていきましょう。",
  ],
  hot: [
    "ありがとうございます。\nこのまま具体的な内容をご案内しますね。",
    "ありがとうございます。\n今動き出せたこと、きっといい流れになります。すぐにご案内します。",
  ],
};

const FOLLOWUP_HOLD: Record<CustomerPhase, string[]> = {
  cold: [
    "承知しました。\n迷うのは自然なことです。\n判断しやすいように、必要なポイントだけ整理してお伝えできます。",
    "もちろんです。\nゆっくり考えてくださいね。\n何か気になることがあればいつでも聞いてください。",
  ],
  warm: [
    "承知しました。\n迷うのは自然なことです。\n判断しやすいように、必要なポイントだけ整理してお伝えできます。",
    "わかりました。\n確認したいことや不安なことがあれば、気軽に聞いてくださいね。",
  ],
  hot: [
    "承知しました。\n迷うのは自然なことです。\n判断しやすいように、必要なポイントだけ整理してお伝えできます。",
    "わかりました。\nただ、今の流れを考えると早めに確認しておく方がいいと感じています。\n気になることがあれば何でも聞いてください。",
  ],
};

const FOLLOWUP_UNKNOWN =
  "ありがとうございます。\n今のお気持ちに合わせてご案内したいので、\n①進めたい\n②少し考えたい\nのどちらかを返していただけますか？";

export interface GenerateFollowupMessageOptions {
  intent:       ReplyIntent;
  phase:        CustomerPhase;
  productName?: string;
  paymentUrl?:  string;
}

/**
 * 返信意図 × フェーズ × 商品名 から次の返信文を生成する。
 * - positive → generateClosingMessage（クロージング専用文）
 * - hold     → フェーズ別の再アプローチ文
 * - unknown  → 選択肢を再提示する共通文
 */
export function generateFollowupMessage({
  intent,
  phase,
  productName,
  paymentUrl,
}: GenerateFollowupMessageOptions): string {
  if (intent === "positive") {
    return generateClosingMessage({ phase, productName, paymentUrl });
  }

  if (intent === "unknown") {
    return FOLLOWUP_UNKNOWN;
  }

  return pickRandom(FOLLOWUP_HOLD[phase]);
}
