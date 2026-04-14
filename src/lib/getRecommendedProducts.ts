import { OFFER_PRODUCTS, type OfferProduct } from "./products";

export function getRecommendedProducts(
  tags: string[],
  presets?: OfferProduct[],
): OfferProduct[] {
  const catalog = presets ?? OFFER_PRODUCTS;

  if (!tags || tags.length === 0) {
    return catalog.filter((p) => p.type === "main");
  }

  const matched = catalog.filter((product) =>
    product.recommendedTags?.some((tag) => tags.includes(tag)),
  );

  const main = catalog.find((p) => p.type === "main");

  const result = [...(main ? [main] : []), ...matched];

  return Array.from(new Set(result));
}
