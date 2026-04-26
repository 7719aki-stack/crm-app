"use client";

import { useState, useEffect, useRef } from "react";
import type { ActionEntry } from "@/app/customers/dummyData";
import type { DbMessage } from "@/app/api/customers/[id]/messages/route";
import { saveCustomerMessageDraft } from "@/lib/messageDraft";
import { generateAdaptiveDraft, type DraftCandidate } from "@/lib/generateAdaptiveDraft";
import type { CustomerPhase } from "@/lib/getRecommendedProducts";
import { LineSendTemplatePanel } from "@/components/LineSendTemplatePanel";
import type { CustomerContext } from "@/lib/recommendTemplates";
import { getStatus } from "@/lib/statuses";
import type { StatusId } from "@/lib/statuses";
import { saveSendResult, SEND_RESULT_LABELS, type SendResultType } from "@/lib/sendResultTracker";

const PHASE_CTA: Record<CustomerPhase, string> = {
  cold: "不安を整理して、今の状態を見てみる",
  warm: "このまま進んだ場合の結果を確認する",
  hot:  "この流れを変えにいく",
};
const PHASE_SUB_CTA: Record<CustomerPhase, string> = {
  cold: "このままだとどうなるか確認する",
  warm: "このまま進んだ場合、どうなるかを確認する",
  hot:  "ここで動かないと、今と同じ結果が続きます",
};
const FALLBACK_CTA = "この内容で送信";

function resolveHttpError(status: number, serverMsg?: string): string {
  if (status === 401) return "LINEトークンが無効です";
  if (status === 400) return "リクエストが不正です";
  if (status === 500) return "サーバーエラーが発生しました";
  return serverMsg ?? "LINE送信に失敗しました";
}

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
  /** 送信内容が messages テーブルに保存されたときに呼ばれる */
  onDbMessageSaved?: (msg: DbMessage) => void;
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
  /** 顧客フェーズ（CTA文言の切り替えに使う） */
  customerPhase?: CustomerPhase;
  /** おすすめテンプレ表示に使う顧客コンテキスト */
  customer?: CustomerContext;
  /** 送信後のステータス自動更新を親に通知する */
  onStatusUpdated?: (newStatus: string) => void;
}

type Phase = "input" | "confirm" | "sending" | "done" | "error";
type DraftConfirmMode = "replace" | "append" | null;

// ステータス更新結果の型
type StatusUpdateInfo = {
  fromLabel: string;
  toLabel:   string;
  error?:    string;
};

export function LineSendPanel({ customerId, line_user_id, onSent, onDbMessageSaved, injectText, injectKey, onEdit, onToneChange, customerTags, customerStatus, customerPhase, customer, onStatusUpdated }: Props) {
  const [text,              setText]              = useState("");
  const [selectedTone,      setSelectedTone]      = useState<Tone>("共感");
  const [nextAction,        setNextAction]         = useState("");
  const [phase,             setPhase]             = useState<Phase>("input");
  const [errorMsg,          setErrorMsg]          = useState("");
  const [draftCandidates,   setDraftCandidates]   = useState<DraftCandidate[]>([]);
  const [draftConfirm,      setDraftConfirm]      = useState<DraftConfirmMode>(null);
  const [pendingDraftText,  setPendingDraftText]  = useState("");

  // ── 自動ステータス更新 ────────────────────────────────────
  const [autoStatusUpdate,  setAutoStatusUpdate]  = useState(true);
  const [pendingNextStatus, setPendingNextStatus] = useState<string | null>(null);
  const [statusUpdateInfo,  setStatusUpdateInfo]  = useState<StatusUpdateInfo | null>(null);

  // ── テンプレートトラッキング ─────────────────────────────
  const [tmplId,       setTmplId]      = useState<string | null>(null);
  const [tmplLabel,    setTmplLabel]   = useState<string | null>(null);

  // ── 送信結果記録 ─────────────────────────────────────────
  const [resultType,   setResultType]  = useState<SendResultType | null>(null);
  const [revenueStr,   setRevenueStr]  = useState("");
  const [resultSaved,  setResultSaved] = useState(false);

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
      // LINE push + messages テーブルへ保存
      const res = await fetch(`/api/customers/${customerId}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(resolveHttpError(res.status, (json as { error?: string }).error));
      }

      const savedMsg: DbMessage = await res.json();

      // 送信履歴を親に渡す（dbMessages への追加）
      onDbMessageSaved?.(savedMsg);

      // next_action が指定されていれば顧客を更新
      if (nextAction) {
        await fetch(`/api/customers/${customerId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ next_action: nextAction }),
        });
      }

      // アクション履歴（localStorage）にも記録
      const { getCustomerRepository } = await import("@/lib/repository");
      const repo  = getCustomerRepository();
      const today = new Date().toISOString().slice(0, 10);
      const entry = repo.addAction(customerId, {
        date:       today,
        type:       "LINE送信",
        note:       text,
        selectedTone,
        finalTone:  selectedTone,
        nextAction: nextAction || null,
      });

      onSent(entry);

      // ── 自動ステータス更新（LINE送信成功後、失敗しても送信成功扱い）───
      let updateInfo: StatusUpdateInfo | null = null;
      if (autoStatusUpdate && pendingNextStatus) {
        const fromLabel = getStatus(customerStatus as StatusId)?.label ?? customerStatus ?? "—";
        const toLabel   = getStatus(pendingNextStatus as StatusId)?.label ?? pendingNextStatus;
        try {
          const statusRes = await fetch(`/api/customers/${customerId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ status: pendingNextStatus }),
          });
          if (!statusRes.ok) throw new Error("ステータス更新APIエラー");
          updateInfo = { fromLabel, toLabel };
          onStatusUpdated?.(pendingNextStatus);
        } catch (statusErr) {
          updateInfo = {
            fromLabel,
            toLabel,
            error: statusErr instanceof Error ? statusErr.message : "更新失敗",
          };
        }
      }
      setStatusUpdateInfo(updateInfo);
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
    setPendingNextStatus(null);
    setStatusUpdateInfo(null);
    setTmplId(null);
    setTmplLabel(null);
    setResultType(null);
    setRevenueStr("");
    setResultSaved(false);
  }

  // ── AI返信生成 ───────────────────────────────────────────
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenError,   setAiGenError]   = useState<string | null>(null);
  const [aiGenSource,  setAiGenSource]  = useState<string | null>(null);

  async function handleAiGenerate() {
    setAiGenLoading(true);
    setAiGenError(null);
    setAiGenSource(null);
    try {
      const res = await fetch("/api/ai/reply-draft", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ customerId }),
      });
      const data = await res.json() as { draft?: string; source?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "AI返信生成に失敗しました");
      if (!data.draft) throw new Error("AI返信生成に失敗しました");
      setAiGenSource(data.source ?? null);
      // 既存テキストがあれば置き換え/追記ダイアログを出す
      handleSelectDraft(data.draft);
    } catch (e) {
      setAiGenError(e instanceof Error ? e.message : "AI返信生成に失敗しました");
    } finally {
      setAiGenLoading(false);
    }
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
    const handleRecordResult = () => {
      if (!resultType) return;
      saveSendResult({
        customerId,
        templateId:    tmplId,
        templateLabel: tmplLabel,
        result:        resultType,
        revenue:       resultType === "converted" ? (parseFloat(revenueStr) || 0) : 0,
        timestamp:     new Date().toISOString(),
      });
      setResultSaved(true);
    };

    return (
      <div className="space-y-4 py-2">
        {/* 送信成功バナー */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-emerald-700">送信成功</p>
        </div>

        {/* ステータス更新結果 */}
        {statusUpdateInfo && (
          <div className={`text-xs rounded-lg px-3 py-2 leading-relaxed ${
            statusUpdateInfo.error
              ? "bg-red-50 text-red-600 border border-red-100"
              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
          }`}>
            {statusUpdateInfo.error ? (
              <><span className="font-semibold">ステータス更新失敗: </span>{statusUpdateInfo.error}</>
            ) : (
              <>
                <span className="font-semibold">ステータス自動更新: </span>
                {statusUpdateInfo.fromLabel}
                <span className="mx-1 text-emerald-400">→</span>
                <span className="font-semibold">{statusUpdateInfo.toLabel}</span>{" "}に変更しました
              </>
            )}
          </div>
        )}

        {/* ── 結果記録UI ───────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            結果を記録
            {tmplLabel && (
              <span className="ml-1.5 text-[10px] font-normal text-brand-500 normal-case">
                テンプレ: {tmplLabel}
              </span>
            )}
          </p>

          {resultSaved ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-semibold">{SEND_RESULT_LABELS[resultType!]}</span>
              {resultType === "converted" && parseFloat(revenueStr) > 0 && (
                <span>— ¥{parseFloat(revenueStr).toLocaleString()}</span>
              )}
              <span>として記録しました</span>
            </div>
          ) : (
            <>
              {/* 結果タイプ選択 */}
              <div className="flex gap-1.5 flex-wrap">
                {(["no_response", "replied", "interested", "converted"] as SendResultType[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResultType(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      resultType === r
                        ? r === "converted"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : r === "interested"
                          ? "bg-amber-500 text-white border-amber-500"
                          : r === "replied"
                          ? "bg-sky-500 text-white border-sky-500"
                          : "bg-gray-400 text-white border-gray-400"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {SEND_RESULT_LABELS[r]}
                  </button>
                ))}
              </div>

              {/* 成約時の売上入力 */}
              {resultType === "converted" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">金額（任意）</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">¥</span>
                    <input
                      type="number"
                      min={0}
                      value={revenueStr}
                      onChange={(e) => setRevenueStr(e.target.value)}
                      placeholder="9800"
                      className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* 記録ボタン */}
              <button
                type="button"
                onClick={handleRecordResult}
                disabled={!resultType}
                className="w-full py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400"
              >
                記録する
              </button>
            </>
          )}
        </div>

        <button
          onClick={reset}
          className="w-full text-xs text-gray-400 hover:text-brand-600 underline underline-offset-2 py-1"
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
          {line_user_id && (
            <>
              <span className="font-semibold">LINE ID:</span>
              <span className="font-mono text-gray-700">{line_user_id}</span>
            </>
          )}
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

  // ── 送信可否判定 ────────────────────────────────────────
  const hasText        = text.trim() !== "";
  const hasLineId      = !!line_user_id;
  const canSend        = hasText && hasLineId;
  const disabledReason = !hasLineId
    ? "LINE ID未設定 — 顧客詳細でLINE IDを登録してください"
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

      {/* ── AI返信生成ボタン ─────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={handleAiGenerate}
          disabled={aiGenLoading}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-brand-600 text-white text-sm font-semibold hover:from-violet-700 hover:to-brand-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {aiGenLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              AI生成中…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI返信を生成
            </>
          )}
        </button>
        {aiGenSource && !aiGenLoading && (
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            {aiGenSource === "fallback" ? "テンプレートから生成（AI未設定）" : `${aiGenSource.toUpperCase()} で生成`}
          </p>
        )}
        {aiGenError && (
          <p className="text-[10px] text-red-500 mt-1 text-center">{aiGenError}</p>
        )}
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

      {/* テンプレ選択 */}
      <LineSendTemplatePanel
        value={text}
        onSelect={(body, meta) => {
          setText(body);
          saveCustomerMessageDraft(customerId, body);
          onEdit?.(body);
          setDraftCandidates([]);
          setPhase("input");
          setPendingNextStatus(meta?.nextStatus ?? null);
          setStatusUpdateInfo(null);
          // テンプレートトラッキング用に id/label を記憶
          setTmplId(meta?.templateId ?? null);
          setTmplLabel(meta?.templateLabel ?? null);
        }}
        customer={customer}
      />

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

      {/* ── 自動ステータス更新トグル ──────────────────────────── */}
      {pendingNextStatus && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2.5 space-y-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoStatusUpdate}
              onChange={(e) => setAutoStatusUpdate(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
            />
            <span className="text-xs font-medium text-gray-700">送信後にステータスを自動更新</span>
          </label>
          {autoStatusUpdate && (
            <p className="text-[10px] text-brand-600 pl-5">
              → <span className="font-semibold">
                {getStatus(pendingNextStatus as StatusId)?.label ?? pendingNextStatus}
              </span>{" "}に変更予定
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => setPhase("confirm")}
        disabled={!canSend}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          canSend
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        {canSend
          ? (customerPhase ? PHASE_CTA[customerPhase] : FALLBACK_CTA)
          : FALLBACK_CTA}
      </button>
      {canSend && customerPhase && (
        <p className="text-xs text-gray-500 text-center -mt-1">
          {PHASE_SUB_CTA[customerPhase]}
        </p>
      )}

      {disabledReason && (
        <p className="text-sm text-red-500 text-center">{disabledReason}</p>
      )}
      {line_user_id && !disabledReason && (
        <p className="text-[10px] text-gray-400 text-center font-mono truncate">LINE ID: {line_user_id}</p>
      )}
    </div>
  );
}
