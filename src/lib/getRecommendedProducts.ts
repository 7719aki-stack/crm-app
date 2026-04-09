import { OFFER_PRODUCTS, type OfferProduct } from "./products";

export function getRecommendedProducts(tags: string[]): OfferProduct[] {
  if (!tags || tags.length === 0) {
    return OFFER_PRODUCTS.filter((p) => p.type === "main");
  }

  const matched = OFFER_PRODUCTS.filter((product) =>
    product.recommendedTags?.some((tag) => tags.includes(tag))
  );

  const main = OFFER_PRODUCTS.find((p) => p.type === "main");

  const result = [...(main ? [main] : []), ...matched];

  return Array.from(new Set(result));
}
