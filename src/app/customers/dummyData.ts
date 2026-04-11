// ダミーデータ定義
// 次フェーズでSQLite / API に差し替える

import type { StatusId } from "@/lib/statuses";
import type { ProductId } from "@/lib/products";

/** statuses.ts の StatusId をそのまま使用 */
export type CustomerStatus = StatusId;

export type Category       = "片思い" | "復縁" | "不倫" | "婚活" | "複雑系" | "浮気確認";
export type Temperature    = "cold" | "cool" | "warm" | "hot";
export type CrisisLevel    = 1 | 2 | 3 | 4 | 5;

export interface CustomerRow {
  id:            number;
  name:          string;
  display_name:  string;
  category:      Category;
  status:        CustomerStatus;
  tags:          string[];
  crisis_level:  CrisisLevel;
  temperature:   Temperature;
  last_contact:  string;        // YYYY-MM-DD
  next_action:   string | null; // YYYY-MM-DD
  total_amount:  number;        // 円
  created_at?:   string;        // YYYY-MM-DD
}

// ─── 詳細画面用の拡張型 ───────────────────────────────
export interface Purchase {
  id:         number;
  date:       string;
  product_id: ProductId;
  /** 表示用メモ（商品名に加えての補足） */
  note?:      string;
  price:      number;
  paid:       boolean;
}

export interface ActionEntry {
  id:            number;
  date:          string;
  type:          "鑑定納品" | "LINE連絡" | "初回対応" | "アップセル提案" | "フォロー" | "LINE送信" | "受信";
  note:          string;
  selectedTone?: string;
  finalTone?:    string;
  nextAction?:   string | null;
  /** キーワード判定で付いた内部種別（将来のシナリオ分岐用） */
  replyIntent?:  string;
}

export interface CustomerDetail extends CustomerRow {
  contact?:       string;
  line_user_id?:  string;
  notes?:         string;
  partner?: {
    name:         string;
    relationship: string;
    situation:    string;
  };
  consultation?: string;
  funnel_stage:  1 | 2 | 3 | 4 | 5; // 無料→有料→アップセル→個別→最上位
  purchases:     Purchase[];
  actions:       ActionEntry[];
}

export const DUMMY_CUSTOMER_DETAIL: CustomerDetail = {
  id:           1,
  name:         "山田花子",
  display_name: "はなちゃん",
  category:     "復縁",
  status:       "full_reversal_purchased",
  tags:         ["復縁", "リピーター", "有料購入", "有料鑑定済み"],
  crisis_level: 5,
  temperature:  "hot",
  last_contact: "2026-03-28",
  next_action:  "2026-03-29",
  total_amount: 120000,
  funnel_stage:  4,
  contact:       "@hanako_line",
  notes:        "感情の浮き沈みが激しい。返信は基本当日中。週1ペースでのフォロー推奨。高感度タイプ、共感ファーストで。",
  partner: {
    name:         "田村誠（34歳）",
    relationship: "元彼氏",
    situation:    "半年前に別れ、現在は彼の方から時々連絡がある。新しい彼女がいる可能性あり。共通の友人経由で動向が入ってくる状況。",
  },
  consultation: "復縁を強く望んでいる。相手の気持ちを知りたい、アプローチのタイミングを見計らいたいという相談が中心。感情的になりやすいため、共感ファーストの対応が効果的。最近は彼からの連絡頻度が増えており、動き出しのタイミングを慎重に見極めている段階。",
  purchases: [
    { id: 1, date: "2026-03-28", product_id: "full_reversal",   note: "復縁スペシャル",  price: 19800, paid: true  },
    { id: 2, date: "2026-03-10", product_id: "destiny_fix",     note: "相性詳細",        price: 15000, paid: true  },
    { id: 3, date: "2026-02-20", product_id: "paid_divination", note: "タイミング鑑定",  price: 9800,  paid: true  },
    { id: 4, date: "2026-02-05", product_id: "paid_divination", note: "片思い鑑定",      price: 9800,  paid: true  },
    { id: 5, date: "2026-01-20", product_id: "paid_divination", note: "相手の本音鑑定",  price: 15000, paid: true  },
    { id: 6, date: "2026-01-15", product_id: "other",           note: "初回無料鑑定",    price: 0,     paid: true  },
  ],
  actions: [
    { id: 1, date: "2026-03-28", type: "鑑定納品",       note: "復縁スペシャル納品。次回4/1にフォロー予定。" },
    { id: 2, date: "2026-03-25", type: "LINE連絡",       note: "彼から連絡が来たとの報告。内容確認のため詳細ヒアリング実施。" },
    { id: 3, date: "2026-03-10", type: "鑑定納品",       note: "相性詳細鑑定を納品。追加でアップセル案内。" },
    { id: 4, date: "2026-02-20", type: "鑑定納品",       note: "タイミング鑑定を納品。" },
    { id: 5, date: "2026-02-18", type: "アップセル提案", note: "タイミング鑑定→相性詳細へのアップ提案。すぐ反応あり。" },
    { id: 6, date: "2026-01-15", type: "初回対応",       note: "無料鑑定実施。初回から反応良好、即日有料へ移行。" },
  ],
};

// ─────────────────────────────────────────────────────
export const DUMMY_CUSTOMERS: CustomerRow[] = [
  {
    id:           1,
    name:         "山田花子",
    display_name: "はなちゃん",
    category:     "復縁",
    status:       "full_reversal_purchased",
    tags:         ["復縁", "リピーター", "有料購入", "有料鑑定済み"],
    crisis_level: 5,
    temperature:  "hot",
    last_contact: "2026-03-28",
    next_action:  "2026-03-29",
    total_amount: 120000,
  },
  {
    id:           2,
    name:         "佐藤美咲",
    display_name: "みさきん",
    category:     "片思い",
    status:       "paid_purchased",
    tags:         ["片思い・進展", "有料購入", "有料興味あり"],
    crisis_level: 3,
    temperature:  "warm",
    last_contact: "2026-03-25",
    next_action:  "2026-04-01",
    total_amount: 45000,
  },
  {
    id:           3,
    name:         "鈴木あい",
    display_name: "あいちゃん",
    category:     "婚活",
    status:       "free_sent",
    tags:         ["無料鑑定済み", "鑑定待ち"],
    crisis_level: 2,
    temperature:  "cool",
    last_contact: "2026-03-29",
    next_action:  "2026-04-05",
    total_amount: 9800,
  },
  {
    id:           4,
    name:         "田中ゆき",
    display_name: "ゆきちゃん",
    category:     "複雑系",
    status:       "destiny_proposed",
    tags:         ["不倫・複雑愛", "リピーター", "有料購入"],
    crisis_level: 4,
    temperature:  "hot",
    last_contact: "2026-03-27",
    next_action:  "2026-03-30",
    total_amount: 89000,
  },
  {
    id:           5,
    name:         "伊藤なな",
    display_name: "ななちゃん",
    category:     "不倫",
    status:       "deep_guided",
    tags:         ["不倫・複雑愛", "有料鑑定済み", "30〜40代"],
    crisis_level: 3,
    temperature:  "cold",
    last_contact: "2026-03-20",
    next_action:  null,
    total_amount: 32000,
  },
  {
    id:           6,
    name:         "高橋りん",
    display_name: "りんりん",
    category:     "婚活",
    status:       "dormant",
    tags:         ["無料鑑定済み", "有料興味無し"],
    crisis_level: 1,
    temperature:  "cold",
    last_contact: "2026-02-15",
    next_action:  null,
    total_amount: 14800,
  },
];
