// ─── 商品定義（恋愛鑑定ビジネス専用）──────────────────────
// タグ・ステータスとの整合性を持たせた商品分類

export type ProductId =
  | "paid_divination"  // 有料鑑定（基本メニュー）
  | "destiny_fix"      // 運命修正
  | "reversal_action"  // 逆転アクション
  | "deep_psychology"  // 深層心理
  | "full_reversal"    // 完全逆転
  | "other";           // その他

export interface ProductDef {
  id:           ProductId;
  label:        string;
  /** タグIDとの対応（@/lib/tags） */
  relatedTag?:  string;
  /** ステータスIDとの対応（@/lib/statuses） */
  relatedStatus?: string;
  badgeClass:   string;
  dotClass:     string;
  /** 参考単価（集計・表示用） */
  typicalPrice: number;
}

export const PRODUCTS: ProductDef[] = [
  {
    id: "paid_divination", label: "有料鑑定",
    relatedTag: "paid_purchased", relatedStatus: "paid_purchased",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dotClass:   "bg-emerald-500",
    typicalPrice: 9800,
  },
  {
    id: "destiny_fix", label: "運命修正",
    relatedTag: "destiny_fix", relatedStatus: "destiny_proposed",
    badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
    dotClass:   "bg-violet-500",
    typicalPrice: 18000,
  },
  {
    id: "reversal_action", label: "逆転アクション",
    relatedTag: "reversal_action", relatedStatus: "reversal_proposed",
    badgeClass: "bg-purple-50 text-purple-700 border border-purple-200",
    dotClass:   "bg-purple-500",
    typicalPrice: 25000,
  },
  {
    id: "deep_psychology", label: "深層心理",
    relatedTag: "deep_psychology", relatedStatus: "deep_psych_proposed",
    badgeClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    dotClass:   "bg-indigo-500",
    typicalPrice: 30000,
  },
  {
    id: "full_reversal", label: "完全逆転",
    relatedTag: "full_reversal", relatedStatus: "full_reversal_purchased",
    badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
    dotClass:   "bg-rose-500",
    typicalPrice: 50000,
  },
  {
    id: "other", label: "その他",
    badgeClass: "bg-gray-100 text-gray-600 border border-gray-200",
    dotClass:   "bg-gray-400",
    typicalPrice: 5000,
  },
];

export const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: ProductId): ProductDef | undefined {
  return PRODUCT_MAP.get(id);
}

// ─── 商品提案用マスタ（Step 4-5）────────────────────────────
export type OfferProduct = {
  id: string;
  name: string;
  price: number;
  type: "main" | "upsell";
  offerType: "core" | "quick" | "deep" | "premium";
  recommendedTags?: string[];
  paymentUrl: string;
  /** おすすめ理由（カード表示用・任意） */
  reason?: string;
};

export const PRICE_PRESETS_KEY = "crm_price_presets_v1";

export function loadPricePresets(): OfferProduct[] {
  if (typeof window === "undefined") return OFFER_PRODUCTS;
  try {
    const raw = localStorage.getItem(PRICE_PRESETS_KEY);
    if (!raw) return OFFER_PRODUCTS;
    const parsed = JSON.parse(raw) as OfferProduct[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : OFFER_PRODUCTS;
  } catch {
    return OFFER_PRODUCTS;
  }
}

export function savePricePresets(presets: OfferProduct[]): void {
  localStorage.setItem(PRICE_PRESETS_KEY, JSON.stringify(presets));
}

export const OFFER_PRODUCTS: OfferProduct[] = [
  {
    id: "main",
    name: "深層恋愛鑑定",
    price: 5000,
    type: "main",
    offerType: "core",
    reason: "まず全体像を把握したい方に向いています",
    paymentUrl: "https://luna-gemnia.stores.jp/items/69c9d1d66b5929170db358ef",
  },
  {
    id: "quick",
    name: "▼恋愛逆転アクション設計",
    price: 9800,
    type: "upsell",
    offerType: "quick",
    recommendedTags: ["片思い・進展"],
    reason: "片思いや進展が止まっている方に最適です",
    paymentUrl: "https://luna-gemnia.stores.jp/items/69c9ee41fc56600ef2a59d98",
  },
  {
    id: "deep",
    name: "▼深層心理完全解析",
    price: 19800,
    type: "upsell",
    offerType: "deep",
    recommendedTags: ["復縁", "不倫・複雑愛"],
    reason: "復縁や複雑愛の深掘りに向いています",
    paymentUrl: "https://luna-gemnia.stores.jp/items/69c9f0dec56f4807d15885ac",
  },
  {
    id: "fix",
    name: "▼運命修正プログラム",
    price: 29800,
    type: "upsell",
    offerType: "deep",
    recommendedTags: ["不倫・複雑愛", "復縁"],
    reason: "今の状況を根本から変えたい方におすすめです",
    paymentUrl: "https://luna-gemnia.stores.jp/items/69c9e3704adc3284c8b022fe",
  },
  {
    id: "premium",
    name: "▼完全逆転プログラム",
    price: 49800,
    type: "upsell",
    offerType: "premium",
    recommendedTags: ["復縁"],
    reason: "本気で関係を逆転させたい方の最上位コースです",
    paymentUrl: "https://luna-gemnia.stores.jp/items/69c9f27a24fa03107a01a46f",
  },
];
