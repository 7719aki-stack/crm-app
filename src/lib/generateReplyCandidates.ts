// ─── タグ別返信補助文生成 ─────────────────────────────────────
// 返すのは「鑑定文そのもの」ではなく「手動鑑定を補助する短文テンプレ」。
// 用途：受付・共感 / 鑑定前つなぎ / 鑑定後の案内 / 次アクション
// tags から都度生成する純粋関数。useState で保持しないこと。

import { generateSalesMessage } from "./generateSalesMessage";

// ── 優先順位（先に定義したタグを優先して使う）───────────────────
// タグマスタの「01_悩み内容」グループに対応する優先順位。
// 複数タグがある場合、この順番で最初にマッチしたタグの候補を使う。
const PRIORITY_ORDER = [
  "復縁",
  "片思い・進展",
  "片思い",       // エイリアス → 片思い・進展
  "不倫・複雑愛",
  "不倫",         // エイリアス → 不倫・複雑愛
  "人間関係・仕事",
  "仕事",         // エイリアス → 人間関係・仕事
  "人間関係",     // エイリアス → 人間関係・仕事
  "金運・開運",
  "金運",         // エイリアス → 金運・開運
] as const;

// ── タグ別補助文（3〜4枚：受付→共感→つなぎ→案内）────────────
const TAG_REPLY_MAP: Record<string, string[]> = {

  "復縁": [
    "お気持ち、受け取りました。\n距離感が難しい時期こそ、焦らないことが大切ですよ。",
    "相手の気持ちの変化、\n一緒に丁寧に見ていきましょう。",
    "時間をかけて関係を育てることが、\n一番の近道になることが多いです。",
    "必要なら、この先の動き方まで\n詳しくお伝えすることもできますよ。",
  ],

  "片思い・進展": [
    "相手のことが気になって、\n落ち着かない気持ちよくわかります。",
    "焦らずに、今の距離感を\n大切にしていきましょう。",
    "安心できる関係は、\n少しずつ積み上げていくものですよ。",
    "進め方が気になる場合は、\n続けてご相談くださいね。",
  ],

  "不倫・複雑愛": [
    "言葉にしにくい悩みですよね。\n無理せずそのまま話してくださいね。",
    "慎重に、でも正直に向き合うことが\n大切だと感じています。",
    "現実的な選択肢を整理しながら、\n一緒に考えていきましょう。",
    "この先どう動くか気になる場合は、\n詳しく見ることもできます。",
  ],

  "人間関係・仕事": [
    "毎日のことだからこそ、\n一人で抱えると疲れてしまいますよね。",
    "まず状況を整理して、\n優先順位を見ていきましょう。",
    "行動を変える前に、\n何が一番大切かを確認しましょう。",
    "具体的な動き方が知りたい場合は、\n続けて送ってくださいね。",
  ],

  "金運・開運": [
    "流れが変わらないと感じている時期は、\n見直しのタイミングかもしれません。",
    "まず今の状況を丁寧に確認して、\n方向性を整理していきますね。",
    "この先の流れが気になる場合は、\n詳しく見ることもできますよ。",
  ],
};

// ── デフォルト候補（タグなし・マッチなし）────────────────────
const DEFAULT_CANDIDATES: string[] = [
  "ご相談ありがとうございます。\nまずは状況をそのまま教えてください。",
  "どんなことでも、\nそのまま話してくれて大丈夫ですよ。",
  "気になることがあれば、\n続けて送ってくださいね。",
];

// ── 内部ヘルパー：タグ名の正規化（エイリアスを正式名に変換）──
const ALIAS_MAP: Record<string, string> = {
  "片思い":   "片思い・進展",
  "不倫":     "不倫・複雑愛",
  "仕事":     "人間関係・仕事",
  "人間関係": "人間関係・仕事",
  "金運":     "金運・開運",
};

function resolveTag(tag: string): string {
  return ALIAS_MAP[tag] ?? tag;
}

// ── メイン関数 ──────────────────────────────────────────────────

export function generateReplyCandidates(
  tags: string[] = [],
  concern?: string
): string[] {
  if (!tags || tags.length === 0) {
    return [
      ...DEFAULT_CANDIDATES,
      generateSalesMessage([], concern),
    ];
  }

  // 優先順位順に最初にマッチしたタグの候補を採用する
  for (const priorityTag of PRIORITY_ORDER) {
    const canonical = resolveTag(priorityTag);
    const hit = tags.some((t) => {
      const resolved = resolveTag(t);
      return resolved === canonical || t === priorityTag;
    });
    if (hit) {
      const candidates = TAG_REPLY_MAP[canonical];
      if (candidates && candidates.length > 0) {
        // 提案文を末尾に追加（ReplyCandidatesPanel で amber バッジ表示）
        return [...candidates, generateSalesMessage(tags, concern)];
      }
    }
  }

  // どのタグにもマッチしなかった場合はデフォルト
  return [
    ...DEFAULT_CANDIDATES,
    generateSalesMessage(tags, concern),
  ];
}

// ─── 文脈考慮型 返信候補生成 ──────────────────────────────────
// tags + name + category + temperature + intent + 直近メッセージを使って
// ①共感 → ②質問 → ③次アクション の3件を生成する。

export type ReplyIntent = "build_trust" | "get_reply" | "invite" | "close";

/** 顧客タイプ（購買パターン・悩みの深さで分類） */
export type CustomerType =
  | "emotional"    // 感情が揺れやすい・共感重視
  | "analytical"   // 状況を整理したい・論理重視
  | "decisive"     // 背中を押してほしい・決断重視
  | "hesitant";    // 迷いが強い・不安が大きい

/** 会話フェーズ */
export type ConversationPhase =
  | "initial"      // 初回〜関係構築中
  | "rapport"      // 信頼醸成済み
  | "upsell"       // 鑑定後・アップセルタイミング
  | "followup";    // フォローアップ

export interface CandidateContext {
  name:           string;
  tags:           string[];
  category:       string;
  temperature:    string;
  recentMessages: Array<{ direction: string; text: string }>;
  /** 会話の目的。デフォルト: "get_reply" */
  intent?:        ReplyIntent;
  /** 会話フェーズ。デフォルト: "initial" */
  phase?:         ConversationPhase;
  /** 顧客タイプ。デフォルト: "emotional" */
  customerType?:  CustomerType;
}

// ── 温度感ごとの書き出しオープナー ───────────────────────────
const TEMP_OPENER: Record<string, string> = {
  hot:  "今の気持ち、しっかり受け取りました。",
  warm: "お話聞かせてくれてありがとうございます。",
  cool: "メッセージありがとうございます。",
  cold: "連絡くれて嬉しいです。",
};

// ── タグ別の悩みキーワード ────────────────────────────────────
const TOPIC_PHRASE: Record<string, string> = {
  "復縁":           "復縁のこと",
  "片思い・進展":   "相手への気持ち",
  "不倫・複雑愛":   "複雑な状況",
  "人間関係・仕事": "今の状況",
  "金運・開運":     "流れのこと",
};

// ── カテゴリ別の締め文 ────────────────────────────────────────
const CATEGORY_CLOSE: Record<string, string> = {
  "片思い":         "一緒に考えていきましょうね。",
  "復縁":           "焦らず、一歩ずつ進みましょう。",
  "不倫":           "慎重に、でも正直に向き合いましょう。",
  "夫婦問題":       "大切な関係だからこそ、丁寧に見ていきますね。",
  "仕事・人間関係": "まず状況を整理しながら進めていきましょう。",
  "金運":           "流れを整えるところから始めてみましょう。",
};

// ── intent × temperature で質問文を切り替える ────────────────
function buildQuestion(intent: ReplyIntent, san: string, topic: string, temp: string): string {
  const isWarm = temp === "hot" || temp === "warm";
  switch (intent) {
    case "build_trust":
      // 共感重視 → 圧を与えない柔らかい問いかけ
      return isWarm
        ? `${san}のペースで、\nもう少し話してみてもらえますか？`
        : `急がなくていいので、\n気になることがあれば教えてくださいね。`;
    case "get_reply":
      // 返信率重視 → 答えやすい具体的な質問
      return isWarm
        ? `${san}の状況をもう少し教えてもらえますか？\n具体的に一緒に考えていきたいので。`
        : `もう少し詳しく教えてもらえると、\n${san}に合ったアドバイスができます。`;
    case "invite":
      // 軽い誘導 → 重くせず次のステップを示す
      return isWarm
        ? `もし気になるなら、\n鑑定でもっと詳しく見ることもできますよ。`
        : `よかったら、\n続きをもう少し話してみてください。`;
    case "close":
      // 締め → 余韻を残して終わる問いかけ
      return `また気になることがあれば、\nいつでも声をかけてくださいね。`;
  }
}

// ── intent ごとの③次アクション文 ────────────────────────────
function buildNextAction(intent: ReplyIntent, san: string, topic: string, close: string): string {
  switch (intent) {
    case "build_trust":
      return `${san}のこと、\nしっかり受け止めながら一緒に考えていきます。\n${close}`;
    case "get_reply":
      return `${topic}については、\n焦らず丁寧に見ていきましょう。\n${close}`;
    case "invite":
      return `もし鑑定を受けてみたいと思ったら、\n気軽に言ってくださいね。\n${close}`;
    case "close":
      return `今日は話してくれてありがとうございます。\n${san}のこと、応援しています。`;
  }
}

// ─── アップセルロジック（phase = "upsell" 専用）─────────────
// customerType × タグで最適な商品を1つ選び、4候補を組み立てる。
// intentロジックとは独立して動作する。

interface UpsellProduct {
  name:   string;
  appeal: string; // 顧客タイプ別のアピール軸
}

// customerType ごとのアピール文言
const TYPE_APPEAL: Record<CustomerType, string> = {
  emotional:  "気持ちがもっと楽になる",
  analytical: "状況をより深く整理できる",
  decisive:   "次の一手が明確になる",
  hesitant:   "不安をひとつひとつ解消できる",
};

// タグ × customerType → おすすめ商品名のマップ
// 優先タグ（PRIORITY_ORDER準拠）ごとに、タイプで推薦商品を変える
const PRODUCT_MAP: Record<string, Record<CustomerType, string>> = {
  "復縁": {
    emotional:  "復縁完全逆転プラン",
    analytical: "関係性診断＋戦略セッション",
    decisive:   "復縁アクションプラン",
    hesitant:   "ステップ別 復縁サポート",
  },
  "片思い・進展": {
    emotional:  "恋愛成就 集中鑑定",
    analytical: "相手の本音 深層分析",
    decisive:   "アプローチ戦略 個別プラン",
    hesitant:   "不安解消 丁寧サポート鑑定",
  },
  "不倫・複雑愛": {
    emotional:  "複雑愛 感情整理セッション",
    analytical: "状況分析＋選択肢整理",
    decisive:   "決断サポート 集中鑑定",
    hesitant:   "じっくり向き合う個別相談",
  },
  "人間関係・仕事": {
    emotional:  "人間関係 改善サポート",
    analytical: "環境分析＋方向性整理",
    decisive:   "行動計画 個別プラン",
    hesitant:   "ストレス解消 丁寧鑑定",
  },
  "金運・開運": {
    emotional:  "運気好転 集中セッション",
    analytical: "流れ分析＋タイミング診断",
    decisive:   "開運アクションプラン",
    hesitant:   "不安解消 流れ整理鑑定",
  },
};

// デフォルト商品（タグ不一致時）
const DEFAULT_PRODUCT: Record<CustomerType, string> = {
  emotional:  "深層心理 特別鑑定",
  analytical: "総合分析 集中セッション",
  decisive:   "個別戦略プラン",
  hesitant:   "じっくり丁寧 個別サポート",
};

function resolveUpsellProduct(
  tags: string[],
  customerType: CustomerType,
): UpsellProduct {
  for (const pt of PRIORITY_ORDER) {
    const canonical = resolveTag(pt);
    const hit = tags.some((t) => resolveTag(t) === canonical || t === pt);
    if (hit && PRODUCT_MAP[canonical]) {
      return {
        name:   PRODUCT_MAP[canonical][customerType],
        appeal: TYPE_APPEAL[customerType],
      };
    }
  }
  return {
    name:   DEFAULT_PRODUCT[customerType],
    appeal: TYPE_APPEAL[customerType],
  };
}

function buildUpsellCandidates(
  san: string,
  opener: string,
  topicPhrase: string,
  lastSnippet: string | null,
  customerType: CustomerType,
  tags: string[],
): string[] {
  const product = resolveUpsellProduct(tags, customerType);

  // ①共感: 鑑定後の気持ちを受け止める
  const c1 = lastSnippet
    ? `${opener}\n「${lastSnippet}…」\nそのお気持ち、よく伝わりました。`
    : `${opener}\n${san}の${topicPhrase}、しっかり受け取りましたよ。`;

  // ②状態整理: 今どういう状況かを言語化してあげる
  const c2 = `鑑定を通じて、${san}の状況が\nだいぶ整理できてきましたね。\n${product.appeal}と思います。`;

  // ③続きの余地: 押し付けず次への橋渡し
  const c3 = `もし${topicPhrase}についてもっと深く見たいと感じたら、\n続きを一緒に考えることもできますよ。`;

  // ④商品提案: 1つだけ・自然なトーンで
  const c4 = `${san}に今おすすめしたいのは\n「${product.name}」です。\n${product.appeal}ので、\nよかったら検討してみてください。`;

  return [c1, c2, c3, c4];
}

export function generateContextualCandidates(ctx: CandidateContext): string[] {
  const {
    name, tags, category, temperature, recentMessages,
    intent = "get_reply",
    phase  = "initial",
    customerType = "emotional",
  } = ctx;

  const san    = name ? `${name}さん` : "あなた";
  const opener = TEMP_OPENER[temperature] ?? TEMP_OPENER.cool;
  const close  = CATEGORY_CLOSE[category] ?? "一緒に考えていきましょうね。";

  // 優先タグからトピックフレーズを解決
  let topicPhrase = "今の気持ち";
  for (const pt of PRIORITY_ORDER) {
    const canonical = resolveTag(pt);
    const hit = tags.some((t) => resolveTag(t) === canonical || t === pt);
    if (hit) {
      topicPhrase = TOPIC_PHRASE[canonical] ?? topicPhrase;
      break;
    }
  }

  // 直近の受信メッセージを取得（顧客発信の最新1件）
  const lastInbound = [...recentMessages]
    .reverse()
    .find((m) => m.direction === "inbound");
  const lastSnippet = lastInbound?.text
    ? lastInbound.text.replace(/\n/g, " ").slice(0, 20)
    : null;

  // ── phase = "upsell": intentロジックを迂回して商品提案フローへ ─
  if (phase === "upsell") {
    return buildUpsellCandidates(san, opener, topicPhrase, lastSnippet, customerType, tags);
  }

  // ── ①共感: intent に関わらず受け止め・安心感を出す ──────────
  const candidate1 = lastSnippet
    ? `${opener}\n${san}の「${lastSnippet}…」という気持ち、\nちゃんと受け止めています。`
    : intent === "build_trust"
      ? `${opener}\n${san}のこと、\nしっかり向き合わせてもらいますね。`
      : `${opener}\n${san}の${topicPhrase}、\nしっかり向き合わせてもらいますね。`;

  // ── ②質問: intent × temperature で返信しやすい問いを生成 ────
  const candidate2 = buildQuestion(intent, san, topicPhrase, temperature);

  // ── ③次アクション: intent ごとに方向を変える ────────────────
  const candidate3 = buildNextAction(intent, san, topicPhrase, close);

  return [candidate1, candidate2, candidate3];
}
