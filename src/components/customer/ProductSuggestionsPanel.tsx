"use client";

import { type OfferProduct } from "@/lib/products";

type Props = {
  products: OfferProduct[];
};

export default function ProductSuggestionsPanel({ products }: Props) {
  if (products.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {products.map((p) => (
        <div
          key={p.id}
          className={`rounded-lg border px-3.5 py-3 ${
            p.type === "main"
              ? "border-brand-200 bg-brand-50"
              : "border-gray-100 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-xs font-semibold leading-snug ${
                p.type === "main" ? "text-brand-700" : "text-gray-800"
              }`}>
                {p.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                ¥{p.price.toLocaleString()}
              </p>
            </div>
            <a
              href={p.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 bg-brand-50 border border-brand-200 px-2 py-1 rounded-md hover:bg-brand-100 transition-colors whitespace-nowrap"
            >
              購入ページ
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
