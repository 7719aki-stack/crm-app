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

/**
 * 顧客の現在の心理状態（アップセル精度向上用）
 * - satisfied : 鑑定直後の満足・納得感が高い状態
 * - anxious   : 不安が再燃・次の一手が見えていない状態
 * - deciding  : 背中を押せば決断できる状態
 */
export type CustomerState = "satisfied" | "anxious" | "deciding";

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
  /** 顧客の現在の心理状態。デフォルト: "satisfied" */
  customerState?: CustomerState;
  /** ログ記録用。省略時はスキップ */
  customerId?:    string;
}

// ─── アップセル表示ログ ──────────────────────────────────────
type UpsellLog = {
  customer_id:    string
  product_id:     string
  customer_type:  string
  customer_state: string
  temperature:    string
  created_at:     string
}

// サーバーサイドのみ実行。クライアントでは即return。失敗しても本処理に影響させない。
function logUpsell(log: UpsellLog): void {
  if (typeof window !== "undefined") return
  Promise.resolve().then(async () => {
    try {
      const { supabase } = await import("./db")
      await supabase.from("upsell_logs").insert(log)
    } catch {
      // ログ失敗は無視
    }
  })
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
// customerType × customerState × タグで商品を選定。
// intentロジックとは独立して動作する。
// 「おすすめ」禁止・「必要になる流れ」を作る文体で統一。

interface UpsellProduct {
  name:        string;
  needPhrase:  string; // 「〜が必要になってくる」流れを作るフレーズ
}

// ── CustomerState × CustomerType → needPhrase ────────────────
// 「必要になる流れ」を自然に作るフレーズ（タイプ × 状態で変わる）
const NEED_PHRASE: Record<CustomerState, Record<CustomerType, string>> = {
  satisfied: {
    emotional:  "この気持ちが続くうちに、次の段階を固めておくと安心です",
    analytical: "今の整理ができているうちに、もう一段深く見ておくと確実です",
    decisive:   "方向が見えてきたこのタイミングで、具体的な動き方を決めておくといいです",
    hesitant:   "少し気持ちが落ち着いてきたなら、次の準備を始めるのに良い時期です",
  },
  anxious: {
    emotional:  "また不安が出てきたということは、もう少し深いところを見る必要があるかもしれません",
    analytical: "状況が変わってきているなら、あらためて整理し直す必要が出てきます",
    decisive:   "迷いが出てきたということは、まだ決め切れていない部分があるということです",
    hesitant:   "不安が続くなら、根本から向き合うことが次のステップになってきます",
  },
  deciding: {
    emotional:  "気持ちの準備ができてきたなら、あとは動き出すための後押しだけです",
    analytical: "判断材料が揃ってきたなら、最後の確認をしておくと動きやすくなります",
    decisive:   "決める気持ちがあるなら、あとはタイミングと方法を合わせるだけです",
    hesitant:   "ここまで来たなら、あと一歩だけ確認しておくと後悔しないと思います",
  },
};

// ── タグ × customerType × customerState → 商品名 ─────────────
// PRODUCT_MAP[タグ][customerType][customerState] で一意に決まる
type ProductByStateMap = Record<CustomerType, Record<CustomerState, string>>;

const PRODUCT_MAP: Record<string, ProductByStateMap> = {
  "復縁": {
    emotional:  { satisfied: "復縁 感情整理 深層セッション", anxious: "復縁 不安解消 集中鑑定",    deciding: "復縁 決断サポート プラン"   },
    analytical: { satisfied: "関係性診断＋次のステップ分析", anxious: "状況再分析＋戦略セッション", deciding: "復縁 行動計画 個別設計"       },
    decisive:   { satisfied: "復縁 完全逆転プラン",          anxious: "復縁 再アプローチ戦略",      deciding: "復縁 即実行 アクションプラン" },
    hesitant:   { satisfied: "ステップ別 復縁サポート",      anxious: "復縁 丁寧ケア 個別鑑定",    deciding: "復縁 背中押し セッション"    },
  },
  "片思い・進展": {
    emotional:  { satisfied: "恋愛成就 感情強化セッション",  anxious: "片思い 不安解消 集中鑑定",   deciding: "想いを伝えるタイミング鑑定"  },
    analytical: { satisfied: "相手の本音 深層分析",          anxious: "関係性の再分析セッション",   deciding: "アプローチ戦略 精密設計"     },
    decisive:   { satisfied: "アプローチ 即実行プラン",      anxious: "片思い 立て直し集中鑑定",    deciding: "告白タイミング 個別プラン"   },
    hesitant:   { satisfied: "片思い 丁寧サポート鑑定",      anxious: "不安解消 じっくり個別相談",  deciding: "背中を押す 恋愛セッション"   },
  },
  "不倫・複雑愛": {
    emotional:  { satisfied: "複雑愛 感情整理セッション",    anxious: "不倫 不安ケア 集中鑑定",     deciding: "関係の方向性 決断鑑定"       },
    analytical: { satisfied: "状況分析＋選択肢整理",          anxious: "状況変化 再分析セッション",  deciding: "今後の動き方 戦略設計"       },
    decisive:   { satisfied: "決断サポート 集中鑑定",         anxious: "複雑愛 再アプローチ戦略",    deciding: "決断 即実行プラン"           },
    hesitant:   { satisfied: "じっくり向き合う個別相談",      anxious: "不安解消 慎重サポート鑑定",  deciding: "一歩踏み出す 背中押しセッション" },
  },
  "人間関係・仕事": {
    emotional:  { satisfied: "人間関係 改善サポートセッション", anxious: "職場不安 解消 集中鑑定",   deciding: "人間関係 動き方 決断鑑定"   },
    analytical: { satisfied: "環境分析＋方向性整理",            anxious: "状況再分析＋対策セッション", deciding: "行動計画 精密設計"          },
    decisive:   { satisfied: "行動計画 即実行プラン",           anxious: "立て直し 戦略セッション",   deciding: "職場改善 決断プラン"        },
    hesitant:   { satisfied: "ストレス解消 丁寧鑑定",           anxious: "不安解消 じっくりサポート", deciding: "一歩踏み出す 個別セッション" },
  },
  "金運・開運": {
    emotional:  { satisfied: "運気好転 感情強化セッション",  anxious: "金運低迷 不安解消鑑定",      deciding: "開運 タイミング決断鑑定"     },
    analytical: { satisfied: "流れ分析＋タイミング診断",     anxious: "状況再分析＋流れ整理",       deciding: "開運 行動計画 精密設計"      },
    decisive:   { satisfied: "開運 即実行アクションプラン",  anxious: "金運 立て直し戦略",          deciding: "開運 決断サポートプラン"     },
    hesitant:   { satisfied: "不安解消 流れ整理鑑定",        anxious: "金運不安 じっくりケア鑑定",  deciding: "背中を押す 開運セッション"   },
  },
};

// デフォルト商品（タグ不一致時）
const DEFAULT_PRODUCT: Record<CustomerType, Record<CustomerState, string>> = {
  emotional:  { satisfied: "深層心理 特別鑑定",       anxious: "感情整理 集中セッション",   deciding: "決断サポート 個別鑑定"     },
  analytical: { satisfied: "総合分析 集中セッション", anxious: "状況再分析 戦略セッション", deciding: "行動計画 精密設計"         },
  decisive:   { satisfied: "個別戦略プラン",          anxious: "立て直し 戦略セッション",   deciding: "即実行 決断プラン"         },
  hesitant:   { satisfied: "じっくり丁寧 個別サポート", anxious: "不安解消 丁寧ケア鑑定", deciding: "背中押し 個別セッション"   },
};

function resolveUpsellProduct(
  tags: string[],
  customerType: CustomerType,
  customerState: CustomerState,
): UpsellProduct {
  for (const pt of PRIORITY_ORDER) {
    const canonical = resolveTag(pt);
    const hit = tags.some((t) => resolveTag(t) === canonical || t === pt);
    if (hit && PRODUCT_MAP[canonical]) {
      return {
        name:       PRODUCT_MAP[canonical][customerType][customerState],
        needPhrase: NEED_PHRASE[customerState][customerType],
      };
    }
  }
  return {
    name:       DEFAULT_PRODUCT[customerType][customerState],
    needPhrase: NEED_PHRASE[customerState][customerType],
  };
}

// ── CustomerState 別の①共感オープナー ────────────────────────
const STATE_EMPATHY: Record<CustomerState, (san: string, snippet: string | null, topic: string, opener: string) => string> = {
  satisfied: (san, snippet, topic, opener) =>
    snippet
      ? `${opener}\n「${snippet}…」\nそこまで整理できてきたんですね。`
      : `${opener}\n${san}の${topic}、ここまで向き合えてきたのが伝わります。`,
  anxious: (san, snippet, _topic, opener) =>
    snippet
      ? `${opener}\n「${snippet}…」\nまた不安が出てきているんですね。`
      : `${opener}\n${san}の気持ち、また揺れてきているのが伝わります。`,
  deciding: (san, snippet, topic, opener) =>
    snippet
      ? `${opener}\n「${snippet}…」\n動き出す気持ちが出てきているんですね。`
      : `${opener}\n${san}の${topic}、そろそろ次の段階が見えてきた感じがします。`,
};

function buildUpsellCandidates(
  san: string,
  opener: string,
  topicPhrase: string,
  lastSnippet: string | null,
  customerType: CustomerType,
  customerState: CustomerState,
  tags: string[],
): string[] {
  const product = resolveUpsellProduct(tags, customerType, customerState);

  // ①共感: customerState 別に受け止め方を変える
  const c1 = STATE_EMPATHY[customerState](san, lastSnippet, topicPhrase, opener);

  // ②状態整理: 現在地を言語化・「必要になる流れ」の起点を作る
  const c2 = `鑑定を通じて状況が見えてきたと思いますが、\n${product.needPhrase}。`;

  // ③続きの余地: 押し付けず「自然にそうなる」感覚で橋渡し
  const c3 = `${topicPhrase}をもう一段深く見ていくなら、\n今がちょうどそのタイミングだと思います。`;

  // ④商品提案: 「〜という人が次に進む先」として自然に提示
  const c4 = `そういう流れで、「${product.name}」に\n進む方が多いです。\nよかったら、どんな内容か聞いてみてください。`;

  return [c1, c2, c3, c4];
}

// ─── 商品マスタ ──────────────────────────────────────────────
type Product = {
  id:    string
  name:  string
  price: number
  url:   string
}

const PRODUCTS: Record<string, Product> = {
  main: {
    id:    "deep_love",
    name:  "深層恋愛鑑定",
    price: 5000,
    url:   "（設定画面のURLを貼り付けてください）",
  },
  action: {
    id:    "action_plan",
    name:  "恋愛行動アクション設計",
    price: 9800,
    url:   "（決済URLを貼り付けてください）",
  },
  psyche: {
    id:    "psyche_analysis",
    name:  "深層心理完全解析",
    price: 19800,
    url:   "（決済URLを貼り付けてください）",
  },
  reverse: {
    id:    "reverse_program",
    name:  "逆転再接近プログラム",
    price: 29800,
    url:   "（決済URLを貼り付けてください）",
  },
  full: {
    id:    "full_program",
    name:  "完全逆転プログラム",
    price: 49800,
    url:   "（決済URLを貼り付けてください）",
  },
}

function buildNeedPhrase(ctx: CandidateContext): string {
  const { customerState = "satisfied" } = ctx
  if (customerState === "anxious")  return "不安の原因を整理しないと同じところで止まりやすいです"
  if (customerState === "deciding") return "ここで動き方を間違えるとタイミング逃します"
  if (customerState === "satisfied") return "ここからの詰めで結果が変わる段階です"
  return "次の動きを整理する段階に入っています"
}

// ── CV率キャッシュ ────────────────────────────────────────
// fallback: データ件数が CV_MIN_COUNT 未満の商品はこの値を使う
const FALLBACK_CV_MAP: Record<string, number> = {
  action_plan:     0.12,
  psyche_analysis: 0.18,
  reverse_program: 0.09,
  full_program:    0.22,
}
const CV_MIN_COUNT = 10              // 最低サンプル数
const CV_CACHE_TTL = 5 * 60 * 1000  // 5分

let _cvCache: { map: Record<string, number>; at: number } | null = null

type CVRow = { product_id: string; upsell_count: number; cv_rate: number }

// SQL:
//   CV率 = 購入数 / 提案数
//   upsell_logs に LEFT JOIN purchase_logs (customer_id + product_id) で集計
//
// 将来: temperature 列で絞ることで温度別CVも計算可能
//   例: WHERE u.temperature = 'hot' GROUP BY u.product_id
function fetchCVMapFromDB(): Record<string, number> {
  try {
    // better-sqlite3 は Node.js 専用。require でクライアントバンドルに含めない
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require("./db") as { getDb: () => { prepare: (sql: string) => { all: () => CVRow[] } } }
    const rows = getDb().prepare(`
      SELECT
        u.product_id,
        COUNT(u.id)                      AS upsell_count,
        COUNT(p.id) * 1.0 / COUNT(u.id) AS cv_rate
      FROM upsell_logs u
      LEFT JOIN purchase_logs p
        ON  u.customer_id = p.customer_id
        AND u.product_id  = p.product_id
      GROUP BY u.product_id
    `).all()

    const map: Record<string, number> = { ...FALLBACK_CV_MAP }
    for (const row of rows) {
      if (row.upsell_count >= CV_MIN_COUNT) {
        map[row.product_id] = row.cv_rate
      }
    }
    return map
  } catch {
    return { ...FALLBACK_CV_MAP }
  }
}

function getProductCVMap(): Record<string, number> {
  // クライアントサイドはfallbackのみ（better-sqlite3 は Node.js 専用）
  if (typeof window !== "undefined") return { ...FALLBACK_CV_MAP }

  const now = Date.now()
  if (_cvCache && now - _cvCache.at < CV_CACHE_TTL) return _cvCache.map

  const map = fetchCVMapFromDB()
  _cvCache = { map, at: now }
  return map
}

// セグメントCVで最高商品を探す。マッチ条件を段階的に緩めて探索する。
// 優先順: type+state+temp → type+state → typeのみ → null（fallback）
function selectBySegmentCV(
  stats: UpsellSegmentStat[],
  customerType: string,
  customerState: string,
  temperature: string,
): Product | null {
  const reliable = stats.filter((s) => s.is_reliable)

  const matchers = [
    (s: UpsellSegmentStat) =>
      s.customer_type === customerType &&
      s.customer_state === customerState &&
      s.temperature === temperature,
    (s: UpsellSegmentStat) =>
      s.customer_type === customerType &&
      s.customer_state === customerState,
    (s: UpsellSegmentStat) =>
      s.customer_type === customerType,
  ]

  for (const match of matchers) {
    const hits = reliable.filter(match).sort((a, b) => b.cv_rate - a.cv_rate)
    if (hits.length > 0) {
      const product = PRODUCTS[hits[0].product_id] ?? Object.values(PRODUCTS).find((p) => p.id === hits[0].product_id)
      if (product) {
        console.log("Upsell selected by segment:", hits[0].product_id, `(cv=${hits[0].cv_rate.toFixed(3)})`)
        return product
      }
    }
  }

  return null
}

function selectUpsellProduct(ctx: CandidateContext): Product {
  const {
    tags          = [],
    customerType  = "emotional",
    customerState = "satisfied",
    temperature   = "cool",
  } = ctx

  // ① セグメントCVで選定（type+state+temp → type+state → typeのみ）
  const stats = getUpsellSegmentStats()
  const segmentProduct = selectBySegmentCV(stats, customerType, customerState, temperature)
  if (segmentProduct) return segmentProduct

  // ② fallback: 文脈ベース候補 × 全体CV順
  const candidates: Product[] = []

  if (tags.some((t) => resolveTag(t) === "不倫・複雑愛")) candidates.push(PRODUCTS.reverse)
  if (customerState === "anxious") candidates.push(temperature === "hot" ? PRODUCTS.full : PRODUCTS.psyche)
  if (customerState === "deciding")  candidates.push(PRODUCTS.action)
  if (temperature   === "cold")      candidates.push(PRODUCTS.psyche)
  if (candidates.length === 0)       candidates.push(PRODUCTS.action)

  const cvMap = getProductCVMap()
  candidates.sort((a, b) => (cvMap[b.id] ?? 0) - (cvMap[a.id] ?? 0))
  console.log("Upsell selected by fallback:", candidates[0].id)
  return candidates[0]
}

// 商品IDごとに「最後の誘導フレーズ」を返す
function buildProductSpecificPhrase(productId: string): string {
  switch (productId) {
    case "action_plan":
      return "どこで動くか、何を送るか、タイミングまで整理したい場合は"
    case "psyche_analysis":
      return "相手の本音や、表に出ていない気持ちまで見ておきたい場合は"
    case "reverse_program":
      return "ここから関係を立て直す流れまで整理したい場合は"
    case "full_program":
      return "今の状況をまとめて、最短で進める形まで固めたい場合は"
    default:
      return "もしここまで整理しておきたい場合は"
  }
}

export function buildUpsellMessage(ctx: CandidateContext): string {
  const {
    customerId,
    customerType  = "emotional",
    customerState = "satisfied",
    temperature   = "cool",
  } = ctx

  const product       = selectUpsellProduct(ctx)
  const needPhrase    = buildNeedPhrase(ctx)
  const specificPhrase = buildProductSpecificPhrase(product.id)
  const priceStr      = product.price.toLocaleString("ja-JP")

  if (customerId) {
    logUpsell({
      customer_id:    customerId,
      product_id:     product.id,
      customer_type:  customerType,
      customer_state: customerState,
      temperature,
      created_at:     new Date().toISOString(),
    })
  }

  return [
    "今回の流れを見ると、",
    "ここが一番分岐になるタイミングです。",
    "",
    "ここで動くかどうかで、",
    "正直かなり結果変わります。",
    "",
    "今の状態だと",
    needPhrase,
    "",
    specificPhrase,
    "",
    `${product.name}（¥${priceStr}）`,
    product.url,
  ].join("\n")
}

// ─── アップセル条件別CV集計 ───────────────────────────────────────────────────
// customer_type / customer_state / temperature / product_id の4軸で成約傾向を集計する。
//
// 用途（将来の活用イメージ）:
//   - customerType 別: emotional / analytical など、どのタイプが最もCV率が高いかを特定
//     → 優先フォローターゲットの選定に使う
//   - customerState 別: anxious / deciding など、どの状態で提案すると成約しやすいか
//     → 提案タイミングの最適化・アップセル挿入フェーズの調整
//   - temperature 別: hot / warm / cool / cold で成約率がどう変わるか
//     → 温度感ごとの商品選定ロジック強化に使う
//   - product_id 別: どの商品がどの条件で売れているかの組み合わせを把握
//     → selectUpsellProduct の候補スコアリングに組み込み予定

export interface UpsellSegmentStat {
  customer_type:  string
  customer_state: string
  temperature:    string
  product_id:     string
  upsell_count:   number
  purchase_count: number
  cv_rate:        number
  /** upsell_count が SEGMENT_MIN_COUNT 未満の場合は参考値扱い */
  is_reliable:    boolean
}

const SEGMENT_MIN_COUNT = 5

/**
 * upsell_logs × purchase_logs を4軸で集計してセグメント別CV率を返す。
 *
 * SQL:
 *   SELECT customer_type, customer_state, temperature, product_id,
 *          COUNT(u.id) AS upsell_count,
 *          COUNT(p.id) AS purchase_count,
 *          COUNT(p.id)*1.0/COUNT(u.id) AS cv_rate
 *   FROM upsell_logs u
 *   LEFT JOIN purchase_logs p
 *     ON u.customer_id = p.customer_id AND u.product_id = p.product_id
 *   GROUP BY customer_type, customer_state, temperature, product_id
 *   ORDER BY cv_rate DESC
 *
 * クライアントサイドでは常に [] を返す（better-sqlite3 は Node.js 専用）。
 * upsell_count < 5 の行は is_reliable=false として返し、呼び出し側で除外可能。
 */
export function getUpsellSegmentStats(): UpsellSegmentStat[] {
  if (typeof window !== "undefined") return []

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require("./db") as { getDb: () => { prepare: (sql: string) => { all: () => Record<string, unknown>[] } } }
    const rows = getDb().prepare(`
      SELECT
        u.customer_type,
        u.customer_state,
        u.temperature,
        u.product_id,
        COUNT(u.id)                      AS upsell_count,
        COUNT(p.id)                      AS purchase_count,
        COUNT(p.id) * 1.0 / COUNT(u.id) AS cv_rate
      FROM upsell_logs u
      LEFT JOIN purchase_logs p
        ON  u.customer_id = p.customer_id
        AND u.product_id  = p.product_id
      GROUP BY
        u.customer_type,
        u.customer_state,
        u.temperature,
        u.product_id
      ORDER BY cv_rate DESC
    `).all()

    return rows.map((row) => ({
      customer_type:  String(row.customer_type),
      customer_state: String(row.customer_state),
      temperature:    String(row.temperature),
      product_id:     String(row.product_id),
      upsell_count:   Number(row.upsell_count),
      purchase_count: Number(row.purchase_count),
      cv_rate:        Number(row.cv_rate),
      is_reliable:    Number(row.upsell_count) >= SEGMENT_MIN_COUNT,
    }))
  } catch {
    return []
  }
}

export function generateContextualCandidates(ctx: CandidateContext): string[] {
  const {
    name, tags, category, temperature, recentMessages,
    intent        = "get_reply",
    phase         = "initial",
    customerType  = "emotional",
    customerState = "satisfied",
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

  // ── phase = "upsell": intentロジックを迂回して決済リンク付き提案文へ ─
  if (phase === "upsell") {
    return [buildUpsellMessage(ctx)];
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
