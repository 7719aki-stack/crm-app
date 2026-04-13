"use client";

import { useState, useEffect, useRef } from "react";
import type { ActionEntry } from "@/app/customers/dummyData";
import { saveCustomerMessageDraft } from "@/lib/messageDraft";

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
}

type Phase = "input" | "confirm" | "sending" | "done" | "error";

export function LineSendPanel({ customerId, line_user_id, onSent, injectText, injectKey, onEdit, onToneChange }: Props) {
  const [text,         setText]         = useState("");
  const [selectedTone, setSelectedTone] = useState<Tone>("共感");
  const [nextAction,   setNextAction]   = useState("");
  const [phase,        setPhase]        = useState<Phase>("input");
  const [errorMsg,     setErrorMsg]     = useState("");

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
                // トーンの見た目切替は必ず実行
                setSelectedTone(tone);
                onToneChange?.(tone);
                const tmpl = TONE_TEMPLATES[tone];
                // 送信文が空のときだけテンプレを注入する（手動入力済みなら上書きしない）
                if (text.trim() === "") {
                  setText(tmpl);
                  saveCustomerMessageDraft(customerId, tmpl);
                  onEdit?.(tmpl);
                }
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

      {/* メッセージ入力 */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">送信文</p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); onEdit?.(e.target.value); }}
          rows={5}
          placeholder="送信するメッセージを入力…"
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
        disabled={!text.trim()}
        className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        確認する →
      </button>

      {line_user_id ? (
        <p className="text-[10px] text-gray-400 text-center font-mono truncate">送信先: {line_user_id}</p>
      ) : (
        <p className="text-[10px] text-amber-500 text-center">LINE ID 未設定 — テスト用 ID に送信されます</p>
      )}
    </div>
  );
}
