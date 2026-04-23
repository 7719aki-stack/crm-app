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
};

// ── テンプレート定義（52件） ──────────────────────────────────
export const TEMPLATES: Template[] = [

  // ── 初回返信（5件） ────────────────────────────────────────
  {
    id: "first_reply_01", category: "初回返信", purpose: "共感",
    label: "読みました",
    body: "メッセージありがとうございます。しっかり読ませていただきました。\n少し一緒に整理していきましょう。",
  },
  {
    id: "first_reply_02", category: "初回返信", purpose: "共感",
    label: "丁寧に見ます",
    body: "ご相談ありがとうございます。今のお気持ち、丁寧に見ていきますね。\nまずはゆっくりお話を聞かせてください。",
  },
  {
    id: "first_reply_03", category: "初回返信", purpose: "共感",
    label: "落ち着いて整理",
    body: "送ってくださってありがとうございます。まずは落ち着いて状況を整理していきましょう。\n一人で抱え込まなくて大丈夫ですよ。",
  },
  {
    id: "first_reply_04", category: "初回返信", purpose: "共感",
    label: "受け取りました",
    body: "メッセージ、しっかり受け取りました。\n今の状況、一緒に見ていきますね。",
  },
  {
    id: "first_reply_05", category: "初回返信", purpose: "共感",
    label: "気持ちを聞かせて",
    body: "送ってくれてありがとうございます。\n今どんなお気持ちか、もう少し聞かせてもらえますか？",
  },

  // ── 共感（8件） ────────────────────────────────────────────
  {
    id: "empathy_01", category: "共感", purpose: "共感",
    label: "一人で抱えてた",
    body: "ここまで一人で抱えてきてしんどかったですよね。\nよく送ってくれました。",
  },
  {
    id: "empathy_02", category: "共感", purpose: "共感",
    label: "不安は自然",
    body: "その状況だと不安になるのは自然なことです。\nその気持ちをちゃんと受け取りますね。",
  },
  {
    id: "empathy_03", category: "共感", purpose: "共感",
    label: "気持ちが揺れる",
    body: "気持ちが揺れてしまうのも無理ないです。\nこれだけ真剣に向き合っているんですから。",
  },
  {
    id: "empathy_04", category: "共感", purpose: "共感",
    label: "つらかったですね",
    body: "それはつらかったですね。\nその状況でここまで気持ちを保ってきたこと、伝わっています。",
  },
  {
    id: "empathy_05", category: "共感", purpose: "共感",
    label: "割り切れないですよね",
    body: "そのお気持ち、よくわかります。\n簡単には割り切れないですよね。",
  },
  {
    id: "empathy_06", category: "共感", purpose: "共感",
    label: "頭と気持ちのずれ",
    body: "頭では分かっていても、気持ちがついてこないのは当然です。\n一人で答えを出そうとしなくていいですよ。",
  },
  {
    id: "empathy_07", category: "共感", purpose: "共感",
    label: "傷つきながら向き合ってきた",
    body: "これまでずっと傷つきながら向き合ってきたんですよね。\nその痛みはちゃんと伝わっています。",
  },
  {
    id: "empathy_08", category: "共感", purpose: "共感",
    label: "悩んで当然",
    body: "これだけ複雑な状況で悩まないほうがおかしいです。\nあなたの気持ちは正直ですよ。",
  },

  // ── 信頼構築（6件） ────────────────────────────────────────
  {
    id: "trust_01", category: "信頼構築", purpose: "信頼",
    label: "経験から伝える",
    body: "これまで多くの方の恋愛の流れを見てきました。\n今のような状況も、一緒に整理してきた事例がたくさんあります。",
  },
  {
    id: "trust_02", category: "信頼構築", purpose: "信頼",
    label: "最後まで付き合う",
    body: "一人ひとりの状況に向き合うことを大切にしています。\n今日は最後までお付き合いしますね。",
  },
  {
    id: "trust_03", category: "信頼構築", purpose: "信頼",
    label: "正直に伝える",
    body: "私がお伝えするのは正直な見方だけです。\n都合よく背中を押すのではなく、本当のことをお伝えします。",
  },
  {
    id: "trust_04", category: "信頼構築", purpose: "信頼",
    label: "何度でもOK",
    body: "気になることは何度でも聞いてください。\n遠慮はいりません。",
  },
  {
    id: "trust_05", category: "信頼構築", purpose: "信頼",
    label: "安心して話して",
    body: "ここでお話しいただいた内容は、他に共有することはありません。\n安心して話してください。",
  },
  {
    id: "trust_06", category: "信頼構築", purpose: "信頼",
    label: "味方です",
    body: "私はあなたの味方として話を聞いています。\n何でも正直に話してくれて大丈夫ですよ。",
  },

  // ── 誘導（8件） ────────────────────────────────────────────
  {
    id: "guide_01", category: "誘導", purpose: "誘導",
    label: "現状確認から",
    body: "まずは今の状況をしっかり整理してみましょう。\nそこから見えてくることがあります。",
  },
  {
    id: "guide_02", category: "誘導", purpose: "誘導",
    label: "相手の状態を見る",
    body: "お相手の今の気持ちの向きを確認しておくと、次の動き方が見えやすくなります。",
  },
  {
    id: "guide_03", category: "誘導", purpose: "誘導",
    label: "流れを読む",
    body: "今のタイミングを逃すと、流れが変わってしまう可能性があります。\n一度きちんと確認しておきましょう。",
  },
  {
    id: "guide_04", category: "誘導", purpose: "誘導",
    label: "深層を見る提案",
    body: "表面的なやりとりだけでなく、お相手の深層を見ておくと状況が整理されます。",
  },
  {
    id: "guide_05", category: "誘導", purpose: "誘導",
    label: "具体的な行動へ",
    body: "気持ちを整理したら、次は具体的な動き方を考えていきましょう。",
  },
  {
    id: "guide_06", category: "誘導", purpose: "誘導",
    label: "今がタイミング",
    body: "今がちょうど動きやすいタイミングだと感じます。\n一緒に確認してみませんか。",
  },
  {
    id: "guide_07", category: "誘導", purpose: "誘導",
    label: "先を見ておく",
    body: "この先どうなるかの流れを少し見ておくと、迷いが減って動きやすくなります。",
  },
  {
    id: "guide_08", category: "誘導", purpose: "誘導",
    label: "一歩踏み出す",
    body: "考えすぎて動けなくなる前に、まず一歩だけ踏み出してみましょう。",
  },

  // ── クロージング（10件） ──────────────────────────────────
  {
    id: "closing_01", category: "クロージング", purpose: "販売",
    label: "深層恋愛鑑定へ",
    body: "より深く見るなら、深層恋愛鑑定（¥5,000）で細かく見ていけます。\n今の状況にしっかり向き合った内容をお渡しできます。",
  },
  {
    id: "closing_02", category: "クロージング", purpose: "販売",
    label: "一段深く見る",
    body: "今回のケースは無料範囲より一段深く見た方が、流れがはっきりします。\n深層恋愛鑑定（¥5,000）で全体を整えましょう。",
  },
  {
    id: "closing_03", category: "クロージング", purpose: "販売",
    label: "判断しやすくなる",
    body: "深層恋愛鑑定（¥5,000）まで見ておくと、かなり判断しやすくなります。\n必要であればご案内しますね。",
  },
  {
    id: "closing_04", category: "クロージング", purpose: "販売",
    label: "今がベストタイミング",
    body: "今の状況が続く前に、深層恋愛鑑定（¥5,000）で一度しっかり見ておくことをおすすめします。",
  },
  {
    id: "closing_05", category: "クロージング", purpose: "販売",
    label: "奥の部分まで",
    body: "お相手の気持ちの奥の部分まで見たいなら、深層恋愛鑑定（¥5,000）が向いています。",
  },
  {
    id: "closing_06", category: "クロージング", purpose: "販売",
    label: "次のステップへ",
    body: "無料の範囲で見えたことをベースに、深層恋愛鑑定（¥5,000）で詳しく整えていきましょう。",
  },
  {
    id: "closing_07", category: "クロージング", purpose: "販売",
    label: "動き方まで整える",
    body: "気持ちを確認するだけでなく、動き方まで整えるなら深層恋愛鑑定（¥5,000）が最適です。",
  },
  {
    id: "closing_08", category: "クロージング", purpose: "販売",
    label: "今なら対応可能",
    body: "今のタイミングであれば、深層恋愛鑑定（¥5,000）でこの状況にしっかり対応できます。",
  },
  {
    id: "closing_09", category: "クロージング", purpose: "販売",
    label: "決断を後押し",
    body: "迷っているなら、深層恋愛鑑定（¥5,000）で一度はっきりさせましょう。\n動き出すための答えが見えてきます。",
  },
  {
    id: "closing_10", category: "クロージング", purpose: "販売",
    label: "今の流れを変える",
    body: "今の流れを変えていくなら、深層恋愛鑑定（¥5,000）で全体を整えてから動くのが一番早いです。",
  },

  // ── 放置防止（5件） ────────────────────────────────────────
  {
    id: "retention_01", category: "放置防止", purpose: "誘導",
    label: "その後は",
    body: "その後、状況に変化はありましたか？\n気になっていたのでご連絡しました。",
  },
  {
    id: "retention_02", category: "放置防止", purpose: "誘導",
    label: "少し時間が経って",
    body: "前回から少し時間が経ちましたが、お気持ちはいかがですか？\nまた何かあれば一緒に見ていきましょう。",
  },
  {
    id: "retention_03", category: "放置防止", purpose: "誘導",
    label: "タイミングを逃さない",
    body: "状況が変わりやすいタイミングなので、早めに動いた方がいいかもしれません。\nお力になれますよ。",
  },
  {
    id: "retention_04", category: "放置防止", purpose: "誘導",
    label: "迷いが強い時こそ",
    body: "迷いが強くなってきた時ほど、早めに整理した方が楽になります。\n今がそのタイミングかもしれません。",
  },
  {
    id: "retention_05", category: "放置防止", purpose: "誘導",
    label: "いつでも声をかけて",
    body: "いつでも声をかけてください。\n必要になったタイミングで一緒に見ていきます。",
  },

  // ── アップセル（6件） ──────────────────────────────────────
  {
    id: "upsell_01", category: "アップセル", purpose: "販売",
    label: "逆転アクション設計",
    body: "片思いや進展が止まっているなら、恋愛逆転アクション設計（¥9,800）が向いています。\n具体的な動き方まで一緒に固めていけます。",
  },
  {
    id: "upsell_02", category: "アップセル", purpose: "販売",
    label: "深層心理完全解析",
    body: "復縁や複雑な状況を深く整理したいなら、深層心理完全解析（¥19,800）があります。\nお相手の本音の部分まで丁寧に見ていけます。",
  },
  {
    id: "upsell_03", category: "アップセル", purpose: "販売",
    label: "運命修正プログラム",
    body: "今の状況を根本から変えていきたいなら、運命修正プログラム（¥29,800）が合っています。\n全体の流れを整えながら動けるようになります。",
  },
  {
    id: "upsell_04", category: "アップセル", purpose: "販売",
    label: "完全逆転プログラム",
    body: "本気でこの関係を逆転させたいなら、完全逆転プログラム（¥49,800）があります。\n最も深い部分から、動き方の全てを固めていきます。",
  },
  {
    id: "upsell_05", category: "アップセル", purpose: "販売",
    label: "本音と動き方",
    body: "お相手の本音だけでなく、具体的な動き方まで固めたいなら次のステップが向いています。\n必要であればご案内しますね。",
  },
  {
    id: "upsell_06", category: "アップセル", purpose: "販売",
    label: "最上位サポート",
    body: "最短で結果を出したいなら、最も手厚いサポートが受けられる完全逆転プログラム（¥49,800）をご案内できます。",
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
