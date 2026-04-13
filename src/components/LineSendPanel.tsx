"use client";

import { useState, useEffect, useRef } from "react";
import type { ActionEntry } from "@/app/customers/dummyData";
import { saveCustomerMessageDraft } from "@/lib/messageDraft";
import { generateAdaptiveDraft, type DraftCandidate } from "@/lib/generateAdaptiveDraft";

const TONES = ["共感", "背中押し", "アップセル", "報告受け", "フォロー"] as const;
type Tone = typeof TONES[number];

const TONE_TEMPLATES: Record<Tone, string> = {
  "共感":    "さん、そのお気持ちよくわかります。\nまずはゆっくりお話を聞かせてくださいね。",
  "背中押し": "さん、大丈夫ですよ！\n一歩踏み出すタイミングは今だと感じています。\n一緒に進んでいきましょう。",
  "アップセル": "さん、今回のご状況、もう少し詳しく視ることができるメニューがございます。\nよかったらご案内しますね。",
  "報告受け": "ご報告ありがとうございます！\nその後の変化、気にかけていました。\nまたいつでも声をかけてくださいね。",
  "フォロー": "さん、その後いかがですか？\n気になっていたのでご連絡しました。\nよかったらまたお話しましょう。",
};

interface Props {
  customerId:    number;
  line_user_id?: string;
  onSent:        (entry: ActionEntry) => void;
  /** 外部から注入するテキスト（返信候補選択時など） */
  injectText?:   string;
  /** このキーが変化したときだけ injectText を textarea に反映する */
  injectKey?:    number;
  /** ユーザーが textarea を編集（クリア含む）したときに呼ばれるコールバック。新しいテキスト値を渡す */
  onEdit?:       (text: string) => void;
  /** トーンが変化したときに呼ばれるコールバック */
  onToneChange?: (tone: Tone) => void;
  /** 下書き生成に使う顧客タグ */
  customerTags?:   string[];
  /** 下書き生成に使う顧客ステータス（StatusId文字列） */
  customerStatus?: string;
}

type Phase = "input" | "confirm" | "sending" | "done" | "error";
type DraftConfirmMode = "replace" | "append" | null;

export function LineSendPanel({ customerId, line_user_id, onSent, injectText, injectKey, onEdit, onToneChange, customerTags, customerStatus }: Props) {
  const [text,              setText]              = useState("");
  const [selectedTone,      setSelectedTone]      = useState<Tone>("共感");
  const [nextAction,        setNextAction]         = useState("");
  const [phase,             setPhase]             = useState<Phase>("input");
  const [errorMsg,          setErrorMsg]          = useState("");
  const [draftCandidates,   setDraftCandidates]   = useState<DraftCandidate[]>([]);
  const [draftConfirm,      setDraftConfirm]      = useState<DraftConfirmMode>(null);
  const [pendingDraftText,  setPendingDraftText]  = useState("");

  // selectedTone が変化したことを確認するデバッグログ
  useEffect(() => {
    console.log("selectedTone changed", selectedTone);
  }, [selectedTone]);

  // injectKey が変化したときだけ注入する。
  // MessageDraftPanel 編集など injectText だけが変わっても injectKey が同じなら再注入しない。
  const prevInjectKeyRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (injectKey === undefined) return;
    if (injectKey === prevInjectKeyRef.current) return;
    prevInjectKeyRef.current = injectKey;
    const next = injectText ?? "";
    console.log("[LineSendPanel inject]", "injectKey=", injectKey, "text=", JSON.stringify(next));
    // 外部注入が空のとき → 現在選択中トーンのテンプレを自動セット
    const resolved = next !== "" ? next : TONE_TEMPLATES[selectedTone];
    setText(resolved);
    if (resolved !== next) {
      // テンプレ注入した場合は localStorage にも同期（親の onEdit は呼ばない = isLineEdited を上げない）
      saveCustomerMessageDraft(customerId, resolved);
    }
    // テキストがある場合のみ入力フォームに戻す（空クリア時は done 状態を維持）
    if (resolved) setPhase("input");
  // injectText / selectedTone は依存に含めない: injectKey が変化したときだけ注入するのが正しい挙動
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectKey]);

  async function handleSend() {
    setPhase("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/line/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, to: line_user_id }),
      });

      const json = await res.json();

      if (!res.ok) {
        const detail =
          typeof json.error === "object"
            ? JSON.stringify(json.error)
            : (json.error ?? res.statusText);
        throw new Error(detail);
      }

      // actionHistory に記録
      const { getCustomerRepository } = await import("@/lib/repository");
      const repo  = getCustomerRepository();
      const today = new Date().toISOString().slice(0, 10);
      const entry = repo.addAction(customerId, {
        date:         today,
        type:         "LINE送信",
        note:         text,
        selectedTone,
        finalTone:    selectedTone,
        nextAction:   nextAction || null,
      });

      onSent(entry);
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "不明なエラー");
      setPhase("error");
    }
  }

  function reset() {
    setText("");
    setSelectedTone("共感");
    setNextAction("");
    setPhase("input");
    setErrorMsg("");
    setDraftCandidates([]);
    setDraftConfirm(null);
    setPendingDraftText("");
  }

  // ── 下書き生成 ────────────────────────────────────────────
  function handleGenerateDraft() {
    const candidates = generateAdaptiveDraft({
      tone:   selectedTone,
      tags:   customerTags  ?? [],
      status: customerStatus ?? "",
    });
    setDraftCandidates(candidates);
  }

  /** 候補テキストを「置き換え」または「追記」でtextareaに適用する */
  function applyDraft(draftText: string, mode: "replace" | "append") {
    let next: string;
    if (mode === "replace") {
      next = draftText;
    } else {
      next = text ? `${text}\n\n${draftText}` : draftText;
    }
    setText(next);
    saveCustomerMessageDraft(customerId, next);
    onEdit?.(next);
    setDraftCandidates([]);
    setDraftConfirm(null);
    setPendingDraftText("");
    setPhase("input");
  }

  /** 「下書きを作成」ボタンの1クリック目：既存テキストがあれば確認、なければ即適用 */
  function handleSelectDraft(draftText: string) {
    if (text.trim()) {
      setPendingDraftText(draftText);
      setDraftConfirm("replace");
    } else {
      applyDraft(draftText, "replace");
    }
  }

  // ── 送信完了 ──────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-emerald-700">送信完了 — 履歴に記録しました</p>
        <button
          onClick={reset}
          className="text-xs text-gray-400 hover:text-brand-600 underline underline-offset-2"
        >
          続けて送信する
        </button>
      </div>
    );
  }

  // ── 送信前確認 ────────────────────────────────────────
  if (phase === "confirm" || phase === "sending" || phase === "error") {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
          {text}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold">送信先:</span>
          {line_user_id
            ? <span className="font-mono text-gray-700">{line_user_id}</span>
            : <span className="text-amber-600">TEST_USER_ID（フォールバック）</span>
          }
          <span className="font-semibold ml-2">トーン:</span>
          <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">{selectedTone}</span>
          {nextAction && (
            <>
              <span className="font-semibold ml-2">次回:</span>
              <span>{nextAction}</span>
            </>
          )}
        </div>

        {phase === "error" && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 leading-relaxed">
            <span className="font-semibold">送信失敗: </span>{errorMsg}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setPhase("input")}
            disabled={phase === "sending"}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-300 disabled:opacity-40 transition-colors"
          >
            戻る
          </button>
          <button
            onClick={handleSend}
            disabled={phase === "sending"}
            className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {phase === "sending" ? "送信中…" : phase === "error" ? "再送信" : "送信する"}
          </button>
        </div>
      </div>
    );
  }

  // ── 送信可否判定 ──────────────────────────────────────
  const hasLineUserId = !!line_user_id;
  const hasText       = text.trim() !== "";
  const canSend       = hasLineUserId && hasText;
  const disabledReason = !hasLineUserId
    ? "送信先の LINE ID が設定されていません"
    : !hasText
    ? "送信するメッセージを入力してください"
    : null;

  // ── 入力フォーム ──────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* トーン選択 */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">トーン</p>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => {
                console.log("tone clicked", tone);
                setSelectedTone(tone);
                onToneChange?.(tone);
                const tmpl = TONE_TEMPLATES[tone];
                if (text.trim() === "") {
                  setText(tmpl);
                  saveCustomerMessageDraft(customerId, tmpl);
                  onEdit?.(tmpl);
                }
                // トーンが変わったら候補をリセット
                setDraftCandidates([]);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedTone === tone
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-brand-300"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      {/* ── 下書きを作成ボタン ──────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={handleGenerateDraft}
          className="w-full py-2.5 rounded-lg border border-brand-300 bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 hover:border-brand-400 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          このトーンで下書きを作成
        </button>
        <p className="text-[10px] text-gray-400 mt-1 text-center">
          ローカル提案モード — トーン・タグ・ステータスから3案を生成します
        </p>
      </div>

      {/* ── 生成された下書き候補 ────────────────────────── */}
      {draftCandidates.length > 0 && (
        <div className="rounded-lg border border-brand-100 bg-gradient-to-b from-brand-50/60 to-white p-3 space-y-3">
          <p className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">
            生成された下書き — 選んで適用してください
          </p>
          {draftCandidates.map((c) => (
            <div key={c.strength} className="rounded-lg border border-gray-100 bg-white p-3 space-y-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  c.strength === "gentle"
                    ? "bg-sky-50 text-sky-600 border border-sky-100"
                    : c.strength === "standard"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-amber-50 text-amber-600 border border-amber-100"
                }`}>
                  {c.label}
                </span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{c.text}</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSelectDraft(c.text)}
                  className="flex-1 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
                >
                  置き換え
                </button>
                <button
                  type="button"
                  onClick={() => applyDraft(c.text, "append")}
                  className="flex-1 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  追記
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraftCandidates([])}
            className="w-full text-[11px] text-gray-400 hover:text-gray-500 transition-colors"
          >
            閉じる
          </button>
        </div>
      )}

      {/* ── 既存テキストへの置き換え確認ダイアログ ──── */}
      {draftConfirm !== null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2.5">
          <p className="text-xs font-semibold text-amber-800">
            送信文に文章が入っています。どうしますか？
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyDraft(pendingDraftText, "replace")}
              className="flex-1 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              置き換え
            </button>
            <button
              type="button"
              onClick={() => applyDraft(pendingDraftText, "append")}
              className="flex-1 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              追記
            </button>
            <button
              type="button"
              onClick={() => { setDraftConfirm(null); setPendingDraftText(""); }}
              className="flex-1 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:border-gray-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* メッセージ入力 */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">送信文</p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); onEdit?.(e.target.value); }}
          rows={5}
          placeholder="送信するメッセージを入力…&#10;または上の「下書きを作成」から生成してください"
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none placeholder:text-gray-300"
        />
      </div>

      {/* 次回アクション日（任意） */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">次回アクション日（任意）</p>
        <input
          type="date"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      <button
        onClick={() => setPhase("confirm")}
        disabled={!canSend}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          canSend
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        確認する →
      </button>

      {disabledReason ? (
        <p className="text-sm text-red-500 text-center">{disabledReason}</p>
      ) : (
        <p className="text-[10px] text-gray-400 text-center font-mono truncate">送信先: {line_user_id}</p>
      )}
    </div>
  );
}
