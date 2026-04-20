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
