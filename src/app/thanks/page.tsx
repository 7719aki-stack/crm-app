"use client";

// ── サンクスページ ─────────────────────────────────────────
// 購入完了後にリダイレクトされるページ。
// アップセルオファー（10,000円プラン）を表示する。

import { useState } from "react";
import Link from "next/link";

// URL パラメータ例: /thanks?customer_id=123&price=5000&name=田中さん
export default function ThanksPage() {
  const [upsellSent, setUpsellSent]   = useState(false);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellError, setUpsellError] = useState("");

  // URLパラメータを取得（CSR）
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const customerId = params.get("customer_id");
  const name       = params.get("name") ?? "あなた";
  const price      = Number(params.get("price") ?? 0);

  async function handleUpsell() {
    if (!customerId) return;
    setUpsellLoading(true);
    setUpsellError("");
    try {
      const res = await fetch("/api/upsell", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customer_id:  Number(customerId),
          type:         "upsell",
          upsell_price: 10000,
        }),
      });
      if (!res.ok) throw new Error("送信に失敗しました");
      setUpsellSent(true);
    } catch (e) {
      setUpsellError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setUpsellLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* 購入完了カード */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg px-8 py-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            ご購入ありがとうございます！
          </h1>
          <p className="text-sm text-gray-500 mb-1">{name} 様</p>
          {price > 0 && (
            <p className="text-xs text-gray-400">
              ¥{price.toLocaleString()} のお支払いを確認しました
            </p>
          )}
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            鑑定結果は順次お届けします。<br />
            今しばらくお待ちください。
          </p>
        </div>

        {/* アップセルカード */}
        {!upsellSent ? (
          <div className="bg-white rounded-2xl border border-violet-200 shadow-lg px-8 py-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                特別オファー
              </span>
              <span className="text-xs text-gray-400">今だけ</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              より深い鑑定で、<br />
              <span className="text-violet-600">人生を変える答え</span>を手に入れませんか？
            </h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              通常鑑定では届かない、あなたの深層心理・
              縁の流れ・最善の行動指針まで余すことなく鑑定。
              購入者限定の特別プランです。
            </p>

            <div className="bg-violet-50 rounded-xl px-4 py-3 mb-4 text-center">
              <p className="text-xs text-violet-500 line-through mb-0.5">通常 ¥15,000</p>
              <p className="text-3xl font-bold text-violet-700">¥10,000</p>
              <p className="text-xs text-violet-500 mt-0.5">購入者特別価格</p>
            </div>

            <ul className="space-y-1.5 mb-5 text-sm text-gray-600">
              {[
                "深層心理・潜在的な感情の流れを鑑定",
                "今後3ヶ月の縁の動きと転換点を明示",
                "最善の行動プランを具体的にアドバイス",
                "無制限の追加質問（3日間）",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            {upsellError && (
              <p className="text-xs text-red-500 mb-3 text-center">{upsellError}</p>
            )}

            <button
              onClick={handleUpsell}
              disabled={upsellLoading}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors text-sm shadow-md"
            >
              {upsellLoading ? "送信中…" : "今すぐ特別プランに申し込む →"}
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              申し込み後、LINEにてご案内をお送りします
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg px-8 py-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-800 mb-1">
              申し込みを受け付けました！
            </p>
            <p className="text-sm text-gray-500">
              LINEにてご案内をお送りします。<br />しばらくお待ちください。
            </p>
          </div>
        )}

        <div className="text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← 管理画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
