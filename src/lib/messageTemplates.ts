// ── 型定義 ──────────────────────────────────────────────────

/** LineSendTemplatePanel との後方互換用 */
export type MessageTemplate = {
  label: string;
  body:  string;
};

export type TemplateCategory = {
  id:        string;
  name:      string;
  templates: MessageTemplate[];
};

/** 拡張テンプレート型 */
export type Template = {
  id:       string;
  category: string;
  label:    string;
  body:     string;
  purpose:  "共感" | "信頼" | "誘導" | "販売";
  /** 送信後に自動適用するステータスID（StatusId） */
  nextStatus?: string;
  /** おすすめスコアリング用メタデータ */
  recommendedFor?: {
    categories?:   string[];
    statuses?:     string[];
    tags?:         string[];
    temperatures?: string[];
    funnel_stages?: number[];
  };
};

// ── カテゴリIDマップ ──────────────────────────────────────────
const CATEGORY_ID: Record<string, string> = {
  "初回返信":     "first_reply",
  "共感":         "empathy",
  "信頼構築":     "trust",
  "誘導":         "guide",
  "クロージング": "closing",
  "放置防止":     "retention",
  "アップセル":   "upsell",
  "フォロー":     "follow_up",
};

// ── ステータスグループ定義（recommendedFor 記述用） ────────────
const LEAD_S  = ["new_reg", "educating"];
const DIV_S   = ["divination_guided", "info_received", "free_sent"];
const PAID_S  = ["deep_guided", "paid_purchased"];
const UP_S    = ["destiny_proposed", "reversal_proposed", "deep_psych_proposed",
                 "full_reversal_sounded", "full_reversal_purchased"];
const EXIT_S  = ["dormant", "churned"];

// ── テンプレート定義（53件） ──────────────────────────────────
export const TEMPLATES: Template[] = [

  // ── 初回返信（5件） ────────────────────────────────────────
  {
    id: "first_reply_01", category: "初回返信", purpose: "共感",
    label: "読みました", nextStatus: "educating",
    body: "メッセージありがとうございます。しっかり読ませていただきました。\n少し一緒に整理していきましょう。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1] },
  },
  {
    id: "first_reply_02", category: "初回返信", purpose: "共感",
    label: "丁寧に見ます", nextStatus: "educating",
    body: "ご相談ありがとうございます。今のお気持ち、丁寧に見ていきますね。\nまずはゆっくりお話を聞かせてください。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1] },
  },
  {
    id: "first_reply_03", category: "初回返信", purpose: "共感",
    label: "落ち着いて整理", nextStatus: "educating",
    body: "送ってくださってありがとうございます。まずは落ち着いて状況を整理していきましょう。\n一人で抱え込まなくて大丈夫ですよ。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], temperatures: ["hot", "warm"], funnel_stages: [1] },
  },
  {
    id: "first_reply_04", category: "初回返信", purpose: "共感",
    label: "受け取りました", nextStatus: "educating",
    body: "メッセージ、しっかり受け取りました。\n今の状況、一緒に見ていきますね。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1] },
  },
  {
    id: "first_reply_05", category: "初回返信", purpose: "共感",
    label: "気持ちを聞かせて", nextStatus: "educating",
    body: "送ってくれてありがとうございます。\n今どんなお気持ちか、もう少し聞かせてもらえますか？",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1] },
  },

  // ── 共感（8件） ────────────────────────────────────────────
  {
    id: "empathy_01", category: "共感", purpose: "共感",
    label: "一人で抱えてた",
    body: "ここまで一人で抱えてきてしんどかったですよね。\nよく送ってくれました。",
    recommendedFor: { temperatures: ["hot", "warm", "cold"], funnel_stages: [1, 2] },
  },
  {
    id: "empathy_02", category: "共感", purpose: "共感",
    label: "不安は自然",
    body: "その状況だと不安になるのは自然なことです。\nその気持ちをちゃんと受け取りますね。",
    recommendedFor: { temperatures: ["hot", "warm", "cold", "cool"], funnel_stages: [1, 2] },
  },
  {
    id: "empathy_03", category: "共感", purpose: "共感",
    label: "気持ちが揺れる",
    body: "気持ちが揺れてしまうのも無理ないです。\nこれだけ真剣に向き合っているんですから。",
    recommendedFor: { temperatures: ["hot", "warm"], funnel_stages: [1, 2, 3] },
  },
  {
    id: "empathy_04", category: "共感", purpose: "共感",
    label: "つらかったですね",
    body: "それはつらかったですね。\nその状況でここまで気持ちを保ってきたこと、伝わっています。",
    recommendedFor: {
      temperatures: ["hot", "warm"],
      categories: ["復縁", "不倫", "複雑系"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "empathy_05", category: "共感", purpose: "共感",
    label: "割り切れないですよね",
    body: "そのお気持ち、よくわかります。\n簡単には割り切れないですよね。",
    recommendedFor: { categories: ["復縁", "不倫", "複雑系"], funnel_stages: [1, 2] },
  },
  {
    id: "empathy_06", category: "共感", purpose: "共感",
    label: "頭と気持ちのずれ",
    body: "頭では分かっていても、気持ちがついてこないのは当然です。\n一人で答えを出そうとしなくていいですよ。",
    recommendedFor: { temperatures: ["warm", "hot", "cold"], funnel_stages: [1, 2] },
  },
  {
    id: "empathy_07", category: "共感", purpose: "共感",
    label: "傷つきながら向き合ってきた",
    body: "これまでずっと傷つきながら向き合ってきたんですよね。\nその痛みはちゃんと伝わっています。",
    recommendedFor: {
      categories: ["復縁", "不倫", "複雑系"],
      temperatures: ["hot", "warm"],
      funnel_stages: [1, 2, 3],
    },
  },
  {
    id: "empathy_08", category: "共感", purpose: "共感",
    label: "悩んで当然",
    body: "これだけ複雑な状況で悩まないほうがおかしいです。\nあなたの気持ちは正直ですよ。",
    recommendedFor: {
      categories: ["不倫", "複雑系", "浮気確認"],
      funnel_stages: [1, 2],
    },
  },

  // ── 信頼構築（6件） ────────────────────────────────────────
  {
    id: "trust_01", category: "信頼構築", purpose: "信頼",
    label: "経験から伝える",
    body: "これまで多くの方の恋愛の流れを見てきました。\n今のような状況も、一緒に整理してきた事例がたくさんあります。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1, 2] },
  },
  {
    id: "trust_02", category: "信頼構築", purpose: "信頼",
    label: "最後まで付き合う",
    body: "一人ひとりの状況に向き合うことを大切にしています。\n今日は最後までお付き合いしますね。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1, 2] },
  },
  {
    id: "trust_03", category: "信頼構築", purpose: "信頼",
    label: "正直に伝える",
    body: "私がお伝えするのは正直な見方だけです。\n都合よく背中を押すのではなく、本当のことをお伝えします。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1, 2] },
  },
  {
    id: "trust_04", category: "信頼構築", purpose: "信頼",
    label: "何度でもOK",
    body: "気になることは何度でも聞いてください。\n遠慮はいりません。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S, ...PAID_S], funnel_stages: [1, 2] },
  },
  {
    id: "trust_05", category: "信頼構築", purpose: "信頼",
    label: "安心して話して",
    body: "ここでお話しいただいた内容は、他に共有することはありません。\n安心して話してください。",
    recommendedFor: { statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1, 2] },
  },
  {
    id: "trust_06", category: "信頼構築", purpose: "信頼",
    label: "味方です",
    body: "私はあなたの味方として話を聞いています。\n何でも正直に話してくれて大丈夫ですよ。",
    recommendedFor: { temperatures: ["cold", "cool"], statuses: [...LEAD_S, ...DIV_S], funnel_stages: [1, 2] },
  },

  // ── 誘導（8件） ────────────────────────────────────────────
  {
    id: "guide_01", category: "誘導", purpose: "誘導",
    label: "現状確認から", nextStatus: "divination_guided",
    body: "まずは今の状況をしっかり整理してみましょう。\nそこから見えてくることがあります。",
    recommendedFor: { statuses: [...DIV_S, "deep_guided"], temperatures: ["warm", "cool"], funnel_stages: [1, 2] },
  },
  {
    id: "guide_02", category: "誘導", purpose: "誘導",
    label: "相手の状態を見る", nextStatus: "divination_guided",
    body: "お相手の今の気持ちの向きを確認しておくと、次の動き方が見えやすくなります。",
    recommendedFor: {
      categories: ["片思い", "復縁", "不倫"],
      statuses: [...DIV_S, "deep_guided"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "guide_03", category: "誘導", purpose: "誘導",
    label: "流れを読む", nextStatus: "divination_guided",
    body: "今のタイミングを逃すと、流れが変わってしまう可能性があります。\n一度きちんと確認しておきましょう。",
    recommendedFor: { temperatures: ["warm", "hot"], statuses: [...DIV_S, "deep_guided"], funnel_stages: [1, 2] },
  },
  {
    id: "guide_04", category: "誘導", purpose: "誘導",
    label: "深層を見る提案", nextStatus: "divination_guided",
    body: "表面的なやりとりだけでなく、お相手の深層を見ておくと状況が整理されます。",
    recommendedFor: {
      categories: ["復縁", "不倫", "複雑系"],
      statuses: ["free_sent", "deep_guided"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "guide_05", category: "誘導", purpose: "誘導",
    label: "具体的な行動へ", nextStatus: "divination_guided",
    body: "気持ちを整理したら、次は具体的な動き方を考えていきましょう。",
    recommendedFor: { temperatures: ["warm", "hot"], statuses: [...DIV_S, ...PAID_S], funnel_stages: [1, 2] },
  },
  {
    id: "guide_06", category: "誘導", purpose: "誘導",
    label: "今がタイミング", nextStatus: "divination_guided",
    body: "今がちょうど動きやすいタイミングだと感じます。\n一緒に確認してみませんか。",
    recommendedFor: { temperatures: ["warm", "hot"], statuses: ["free_sent", "deep_guided"], funnel_stages: [1, 2] },
  },
  {
    id: "guide_07", category: "誘導", purpose: "誘導",
    label: "先を見ておく", nextStatus: "divination_guided",
    body: "この先どうなるかの流れを少し見ておくと、迷いが減って動きやすくなります。",
    recommendedFor: { temperatures: ["warm", "cool"], statuses: [...DIV_S], funnel_stages: [1, 2] },
  },
  {
    id: "guide_08", category: "誘導", purpose: "誘導",
    label: "一歩踏み出す", nextStatus: "divination_guided",
    body: "考えすぎて動けなくなる前に、まず一歩だけ踏み出してみましょう。",
    recommendedFor: { temperatures: ["cold", "cool"], statuses: [...DIV_S, ...LEAD_S], funnel_stages: [1, 2] },
  },

  // ── クロージング（10件） ──────────────────────────────────
  {
    id: "closing_01", category: "クロージング", purpose: "販売",
    label: "深層恋愛鑑定へ", nextStatus: "deep_guided",
    body: "より深く見るなら、深層恋愛鑑定（¥5,000）で細かく見ていけます。\n今の状況にしっかり向き合った内容をお渡しできます。",
    recommendedFor: {
      statuses: ["free_sent", "deep_guided"],
      temperatures: ["warm", "hot"],
      tags: ["無料鑑定済み", "鑑定待ち"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_02", category: "クロージング", purpose: "販売",
    label: "一段深く見る", nextStatus: "deep_guided",
    body: "今回のケースは無料範囲より一段深く見た方が、流れがはっきりします。\n深層恋愛鑑定（¥5,000）で全体を整えましょう。",
    recommendedFor: {
      statuses: ["free_sent", "deep_guided", "divination_guided"],
      temperatures: ["warm", "hot"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_03", category: "クロージング", purpose: "販売",
    label: "判断しやすくなる", nextStatus: "deep_guided",
    body: "深層恋愛鑑定（¥5,000）まで見ておくと、かなり判断しやすくなります。\n必要であればご案内しますね。",
    recommendedFor: {
      statuses: ["free_sent", "deep_guided"],
      temperatures: ["warm", "cool"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_04", category: "クロージング", purpose: "販売",
    label: "今がベストタイミング", nextStatus: "deep_guided",
    body: "今の状況が続く前に、深層恋愛鑑定（¥5,000）で一度しっかり見ておくことをおすすめします。",
    recommendedFor: {
      statuses: ["deep_guided", "free_sent"],
      temperatures: ["hot"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_05", category: "クロージング", purpose: "販売",
    label: "奥の部分まで", nextStatus: "deep_guided",
    body: "お相手の気持ちの奥の部分まで見たいなら、深層恋愛鑑定（¥5,000）が向いています。",
    recommendedFor: {
      categories: ["片思い", "復縁", "不倫"],
      statuses: ["free_sent", "deep_guided"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_06", category: "クロージング", purpose: "販売",
    label: "次のステップへ", nextStatus: "deep_guided",
    body: "無料の範囲で見えたことをベースに、深層恋愛鑑定（¥5,000）で詳しく整えていきましょう。",
    recommendedFor: {
      statuses: ["free_sent", "deep_guided"],
      temperatures: ["warm", "hot"],
      tags: ["無料鑑定済み"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_07", category: "クロージング", purpose: "販売",
    label: "動き方まで整える", nextStatus: "deep_guided",
    body: "気持ちを確認するだけでなく、動き方まで整えるなら深層恋愛鑑定（¥5,000）が最適です。",
    recommendedFor: {
      statuses: ["free_sent", "deep_guided"],
      temperatures: ["warm", "hot"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_08", category: "クロージング", purpose: "販売",
    label: "今なら対応可能", nextStatus: "deep_guided",
    body: "今のタイミングであれば、深層恋愛鑑定（¥5,000）でこの状況にしっかり対応できます。",
    recommendedFor: {
      statuses: ["deep_guided", "free_sent"],
      temperatures: ["warm", "hot"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_09", category: "クロージング", purpose: "販売",
    label: "決断を後押し", nextStatus: "deep_guided",
    body: "迷っているなら、深層恋愛鑑定（¥5,000）で一度はっきりさせましょう。\n動き出すための答えが見えてきます。",
    recommendedFor: {
      statuses: ["deep_guided", "free_sent"],
      temperatures: ["warm"],
      funnel_stages: [1, 2],
    },
  },
  {
    id: "closing_10", category: "クロージング", purpose: "販売",
    label: "今の流れを変える", nextStatus: "deep_guided",
    body: "今の流れを変えていくなら、深層恋愛鑑定（¥5,000）で全体を整えてから動くのが一番早いです。",
    recommendedFor: {
      statuses: ["deep_guided", "free_sent"],
      temperatures: ["hot", "warm"],
      funnel_stages: [1, 2],
    },
  },

  // ── 放置防止（5件） ────────────────────────────────────────
  {
    id: "retention_01", category: "放置防止", purpose: "誘導",
    label: "その後は", nextStatus: "educating",
    body: "その後、状況に変化はありましたか？\n気になっていたのでご連絡しました。",
    recommendedFor: {
      statuses: [...EXIT_S, "paid_purchased", "full_reversal_purchased"],
      temperatures: ["cold", "cool"],
    },
  },
  {
    id: "retention_02", category: "放置防止", purpose: "誘導",
    label: "少し時間が経って", nextStatus: "educating",
    body: "前回から少し時間が経ちましたが、お気持ちはいかがですか？\nまた何かあれば一緒に見ていきましょう。",
    recommendedFor: {
      statuses: [...EXIT_S, "paid_purchased"],
      temperatures: ["cold", "cool"],
    },
  },
  {
    id: "retention_03", category: "放置防止", purpose: "誘導",
    label: "タイミングを逃さない", nextStatus: "educating",
    body: "状況が変わりやすいタイミングなので、早めに動いた方がいいかもしれません。\nお力になれますよ。",
    recommendedFor: {
      statuses: ["dormant", "paid_purchased"],
      temperatures: ["cold"],
    },
  },
  {
    id: "retention_04", category: "放置防止", purpose: "誘導",
    label: "迷いが強い時こそ", nextStatus: "educating",
    body: "迷いが強くなってきた時ほど、早めに整理した方が楽になります。\n今がそのタイミングかもしれません。",
    recommendedFor: {
      statuses: [...EXIT_S],
      temperatures: ["cold", "cool"],
      tags: ["有料購入", "有料鑑定済み"],
    },
  },
  {
    id: "retention_05", category: "放置防止", purpose: "誘導",
    label: "いつでも声をかけて", nextStatus: "educating",
    body: "いつでも声をかけてください。\n必要になったタイミングで一緒に見ていきます。",
    recommendedFor: {
      statuses: [...EXIT_S],
      temperatures: ["cold", "cool"],
    },
  },

  // ── アップセル（6件） ──────────────────────────────────────
  {
    id: "upsell_01", category: "アップセル", purpose: "販売",
    label: "逆転アクション設計", nextStatus: "reversal_proposed",
    body: "片思いや進展が止まっているなら、恋愛逆転アクション設計（¥9,800）が向いています。\n具体的な動き方まで一緒に固めていけます。",
    recommendedFor: {
      categories: ["片思い", "復縁", "婚活"],
      statuses: ["paid_purchased", "destiny_proposed", "reversal_proposed"],
      tags: ["有料購入", "有料鑑定済み", "リピーター"],
      funnel_stages: [2, 3],
    },
  },
  {
    id: "upsell_02", category: "アップセル", purpose: "販売",
    label: "深層心理完全解析", nextStatus: "deep_psych_proposed",
    body: "復縁や複雑な状況を深く整理したいなら、深層心理完全解析（¥19,800）があります。\nお相手の本音の部分まで丁寧に見ていけます。",
    recommendedFor: {
      categories: ["復縁", "不倫", "複雑系"],
      statuses: ["paid_purchased", "deep_psych_proposed", "full_reversal_sounded"],
      tags: ["有料購入", "有料鑑定済み", "リピーター"],
      funnel_stages: [2, 3, 4],
    },
  },
  {
    id: "upsell_03", category: "アップセル", purpose: "販売",
    label: "運命修正プログラム", nextStatus: "destiny_proposed",
    body: "今の状況を根本から変えていきたいなら、運命修正プログラム（¥29,800）が合っています。\n全体の流れを整えながら動けるようになります。",
    recommendedFor: {
      categories: ["復縁", "複雑系", "不倫"],
      statuses: ["paid_purchased", "destiny_proposed", "reversal_proposed"],
      tags: ["有料購入", "リピーター"],
      funnel_stages: [3, 4],
    },
  },
  {
    id: "upsell_04", category: "アップセル", purpose: "販売",
    label: "完全逆転プログラム", nextStatus: "full_reversal_sounded",
    body: "本気でこの関係を逆転させたいなら、完全逆転プログラム（¥49,800）があります。\n最も深い部分から、動き方の全てを固めていきます。",
    recommendedFor: {
      statuses: ["full_reversal_sounded", "destiny_proposed", "deep_psych_proposed"],
      tags: ["リピーター", "有料購入"],
      temperatures: ["hot"],
      funnel_stages: [3, 4, 5],
    },
  },
  {
    id: "upsell_05", category: "アップセル", purpose: "販売",
    label: "本音と動き方", nextStatus: "destiny_proposed",
    body: "お相手の本音だけでなく、具体的な動き方まで固めたいなら次のステップが向いています。\n必要であればご案内しますね。",
    recommendedFor: {
      statuses: ["paid_purchased", "free_sent", "destiny_proposed"],
      temperatures: ["warm", "hot"],
      funnel_stages: [2, 3],
    },
  },
  {
    id: "upsell_06", category: "アップセル", purpose: "販売",
    label: "最上位サポート", nextStatus: "full_reversal_sounded",
    body: "最短で結果を出したいなら、最も手厚いサポートが受けられる完全逆転プログラム（¥49,800）をご案内できます。",
    recommendedFor: {
      statuses: [...UP_S, "paid_purchased"],
      tags: ["リピーター", "有料購入"],
      temperatures: ["hot"],
      funnel_stages: [3, 4, 5],
    },
  },

  // ── フォロー（5件） ────────────────────────────────────────
  {
    id: "follow_01", category: "フォロー", purpose: "誘導",
    label: "その後は", nextStatus: "educating",
    body: "その後いかがですか？\n気になっていたのでご連絡しました。",
    recommendedFor: {
      statuses: [...EXIT_S, ...LEAD_S],
      temperatures: ["cold", "cool"],
    },
  },
  {
    id: "follow_02", category: "フォロー", purpose: "共感",
    label: "気になっています",
    body: "先日のことがずっと気になっていました。\nよかったらまた話しかけてください。",
    recommendedFor: {
      statuses: [...EXIT_S, "educating"],
      temperatures: ["cold", "cool"],
    },
  },
  {
    id: "follow_03", category: "フォロー", purpose: "誘導",
    label: "状況確認", nextStatus: "educating",
    body: "最近状況に変化はありましたか？\n何かあれば気軽に教えてください。",
    recommendedFor: {
      statuses: [...LEAD_S, ...DIV_S],
      temperatures: ["cool", "warm"],
    },
  },
  {
    id: "follow_04", category: "フォロー", purpose: "信頼",
    label: "お役に立てると",
    body: "何かお力になれることがあればと思いご連絡しました。\nどんな小さなことでも話しかけてください。",
    recommendedFor: {
      statuses: [...EXIT_S, ...LEAD_S],
      temperatures: ["cold"],
    },
  },
  {
    id: "follow_05", category: "フォロー", purpose: "誘導",
    label: "再スタート", nextStatus: "educating",
    body: "少し時間が経ちましたが、また一緒に整理していきませんか？\n状況を教えていただければ、続きからサポートします。",
    recommendedFor: {
      statuses: [...EXIT_S],
      temperatures: ["cold", "cool"],
    },
  },
];

// ── MESSAGE_TEMPLATES（TEMPLATES から自動導出・後方互換） ──────
export const MESSAGE_TEMPLATES: TemplateCategory[] = (() => {
  const map = new Map<string, TemplateCategory>();
  for (const t of TEMPLATES) {
    const catId = CATEGORY_ID[t.category] ?? t.category;
    if (!map.has(catId)) {
      map.set(catId, { id: catId, name: t.category, templates: [] });
    }
    map.get(catId)!.templates.push({ label: t.label, body: t.body });
  }
  return [...map.values()];
})();
