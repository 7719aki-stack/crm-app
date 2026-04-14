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
          {/* 商品名 */}
          <p
            className={`text-xs font-semibold leading-snug ${
              p.type === "main" ? "text-brand-700" : "text-gray-800"
            }`}
          >
            {p.name}
          </p>

          {/* 価格 */}
          <p className="text-xs text-gray-500 mt-0.5">
            ¥{p.price.toLocaleString()}
          </p>

          {/* おすすめ理由 */}
          {p.reason && (
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed border-l-2 border-brand-200 pl-2 italic">
              {p.reason}
            </p>
          )}

          {/* CTA */}
          <div className="mt-2.5">
            <a
              href={p.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                p.type === "main"
                  ? "text-white bg-brand-600 hover:bg-brand-700"
                  : "text-brand-600 bg-brand-50 border border-brand-200 hover:bg-brand-100"
              }`}
            >
              詳しく見る
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
