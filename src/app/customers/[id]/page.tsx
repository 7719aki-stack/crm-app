"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EditCustomerModal } from "@/app/customers/EditCustomerModal";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagEditor } from "@/components/TagEditor";
import { StatusPicker } from "@/components/StatusPicker";
import { LineSendPanel } from "@/components/LineSendPanel";
import { ReceivedMessagePanel } from "@/components/ReceivedMessagePanel";
import { ScenarioQueuePanel } from "@/components/ScenarioQueuePanel";
import { EducationScenarioPanel } from "@/components/EducationScenarioPanel";
import { InterviewPanel } from "@/components/InterviewPanel";
import ReplyCandidatesPanel from "@/components/customer/ReplyCandidatesPanel";
import ProductSuggestionsPanel from "@/components/customer/ProductSuggestionsPanel";
import OfferMessagePanel from "@/components/customer/OfferMessagePanel";
import MessageDraftPanel from "@/components/customer/MessageDraftPanel";
import DiagnosisPanel from "@/components/customer/DiagnosisPanel";
import DiagnosisTemplateSuggestionsPanel from "@/components/customer/DiagnosisTemplateSuggestionsPanel";
import { generateReplyCandidates } from "@/lib/generateReplyCandidates";
import { getRecommendedProducts, resolvePhase } from "@/lib/getRecommendedProducts";
import { generateOfferMessage } from "@/lib/generateOfferMessage";
import {
  getCustomerMessageDraft,
  saveCustomerMessageDraft,
} from "@/lib/messageDraft";
import { getProduct, loadPricePresets, type OfferProduct } from "@/lib/products";
import type { StatusId } from "@/lib/statuses";
import type {
  CustomerDetail,
  CrisisLevel,
  Temperature,
  Purchase,
  ActionEntry,
} from "@/app/customers/dummyData";
import type { DbMessage } from "@/app/api/customers/[id]/messages/route";

// ── 定数 ─────────────────────────────────────────────────
const CRISIS_DOT: Record<CrisisLevel, string> = {
  1: "bg-gray-300", 2: "bg-yellow-400", 3: "bg-amber-400",
  4: "bg-orange-500", 5: "bg-red-500",
};
const CRISIS_META: Record<CrisisLevel, { label: string; cls: string }> = {
  1: { label: "安定",   cls: "text-gray-400" },
  2: { label: "注意",   cls: "text-yellow-600" },
  3: { label: "要注意", cls: "text-amber-600" },
  4: { label: "危険",   cls: "text-orange-600" },
  5: { label: "緊急",   cls: "text-red-600" },
};
const TEMP_CONFIG: Record<Temperature, { emoji: string; label: string; cls: string }> = {
  cold: { emoji: "❄️", label: "冷え気味", cls: "bg-blue-50  text-blue-600  border-blue-100" },
  cool: { emoji: "🌤",  label: "普通",    cls: "bg-gray-100 text-gray-500  border-gray-200" },
  warm: { emoji: "☀️", label: "温まり中", cls: "bg-amber-50 text-amber-600 border-amber-100" },
  hot:  { emoji: "🔥", label: "熱い",     cls: "bg-red-50   text-red-600   border-red-100" },
};
const FUNNEL_STEPS = ["無料鑑定", "有料鑑定", "アップセル", "個別対応", "最上位"] as const;
const ACTION_TYPE_STYLE: Record<ActionEntry["type"], string> = {
  "初回対応":       "bg-blue-100    text-blue-700",
  "鑑定納品":       "bg-brand-100   text-brand-700",
  "LINE連絡":       "bg-emerald-100 text-emerald-700",
  "アップセル提案": "bg-amber-100   text-amber-700",
  "フォロー":       "bg-pink-100    text-pink-700",
  "LINE送信":       "bg-green-100   text-green-700",
  "受信":           "bg-sky-100     text-sky-700",
};

// ── 小コンポーネント ──────────────────────────────────────
function CrisisDots({ level }: { level: CrisisLevel }) {
  const { label, cls } = CRISIS_META[level];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-[3px]">
        {([1,2,3,4,5] as CrisisLevel[]).map((i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${i <= level ? CRISIS_DOT[level] : "bg-gray-100"}`} />
        ))}
      </div>
      <span className={`text-[11px] font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

function TempBadge({ temp }: { temp: Temperature }) {
  const { emoji, label, cls } = TEMP_CONFIG[temp];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
      <span className="text-[11px]">{emoji}</span>{label}
    </span>
  );
}

function SectionCard({
  title, action, children,
}: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── LINE受信メッセージ履歴 ────────────────────────────────
function LineMessageHistory({ messages }: { messages: DbMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-xs text-gray-400">メッセージ履歴はありません</p>;
  }
  return (
    <ol className="space-y-2">
      {messages.map((m) => {
        const dt = m.created_at.replace("T", " ").slice(0, 16);
        return (
          <li key={m.id} className="flex gap-3 items-start">
            <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${
              m.direction === "inbound" ? "bg-sky-400" : "bg-green-400"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  m.direction === "inbound"
                    ? "bg-sky-50 text-sky-700 border border-sky-100"
                    : "bg-green-50 text-green-700 border border-green-100"
                }`}>
                  {m.direction === "inbound" ? "受信" : "送信"}
                </span>
                {m.source && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                    {m.source}
                  </span>
                )}
                <span className="text-[11px] text-gray-400">{dt}</span>
              </div>
              <p className="text-sm text-gray-700 leading-snug whitespace-pre-wrap break-all">{m.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── メインページ ──────────────────────────────────────────
export default function CustomerDetailPage() {
  const params     = useParams<{ id: string }>();
  const customerId = Number(params.id);
  const router     = useRouter();

  const [customer,         setCustomer]         = useState<CustomerDetail | null>(null);
  const [dbMessages,       setDbMessages]       = useState<DbMessage[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [notFound,         setNotFound]         = useState(false);

  // 編集ステート（customer ロード後に初期化）
  const [status,          setStatus]          = useState<StatusId>("new_reg");
  const [tags,            setTags]            = useState<string[]>([]);
  const [notes,           setNotes]           = useState("");
  const [editNotes,       setEditNotes]       = useState(false);
  const [actions,         setActions]         = useState<ActionEntry[]>([]);
  const [line_user_id,      set_line_user_id]      = useState("");
  const [line_user_id_draft, set_line_user_id_draft] = useState("");
  const [editLineId,      setEditLineId]      = useState(false);
  const [savingLineId,    setSavingLineId]    = useState(false);
  const [savingTags,      setSavingTags]      = useState(false);
  const [savingStatus,    setSavingStatus]    = useState(false);
  const [savingNotes,     setSavingNotes]     = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [deleteConfirm,   setDeleteConfirm]   = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [deleteError,     setDeleteError]     = useState<string | null>(null);
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);
  const [lineMessage,     setLineMessageState] = useState("");
  const [lineInjectKey,   setLineInjectKey]   = useState(0);
  /** ユーザーが LINE送信欄 textarea を一度でも編集したら true。
   *  true のときは injectKey をインクリメントしない → 自動上書きしない */
  const [isLineEdited,    setIsLineEdited]    = useState(false);
  const [replyText,       setReplyText]       = useState("");
  const [replySending,    setReplySending]    = useState(false);
  const [replyError,      setReplyError]      = useState<string | null>(null);
  const [replySuccess,    setReplySuccess]    = useState(false);
  const [aiCandidates,   setAiCandidates]   = useState<string[] | null>(null);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [aiError,        setAiError]        = useState<string | null>(null);
  const [lineTone,       setLineTone]       = useState("共感");
  const [pricePresets,   setPricePresets]   = useState<OfferProduct[]>([]);

  /** 返信候補・オファー文などの「明示的な注入」。
   *  ユーザーが未編集の場合のみ LineSendPanel にも反映する */
  function setLineMessage(text: string) {
    console.log("[lineMessage set]", "replace", JSON.stringify(text), "isLineEdited=", isLineEdited);
    setLineMessageState(text);
    saveCustomerMessageDraft(customerId, text);
    if (!isLineEdited) {
      setLineInjectKey((k) => k + 1);
    }
  }
  /** MessageDraftPanel の onChange 専用。下書きを保存するが LineSendPanel には再注入しない */
  function handleDraftChange(text: string) {
    console.log("[lineMessage set]", "draft-change", JSON.stringify(text));
    setLineMessageState(text);
    saveCustomerMessageDraft(customerId, text);
  }
  function appendLineMessage(text: string) {
    setLineMessageState((prev) => {
      // 改行・先頭末尾空白を正規化して重複判定（\r\n / \n の差異も吸収）
      const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim().replace(/\s+/g, " ");
      if (normalize(prev).includes(normalize(text))) return prev;
      const next = prev ? `${prev}\n\n${text}` : text;
      console.log("[lineMessage set]", "append", JSON.stringify(next));
      saveCustomerMessageDraft(customerId, next);
      return next;
    });
    // ユーザーが未編集の場合のみ LineSendPanel に反映する
    if (!isLineEdited) {
      setLineInjectKey((k) => k + 1);
    }
  }

  // ── AI返信候補生成 ────────────────────────────────────────
  async function generateAiReplies() {
    setAiCandidates(null);
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/reply-suggestions`, {
        method: "POST",
      });
      const data = await res.json() as {
        candidates?: Array<{ label: string; text: string }>;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const msg = data.error ?? "AI生成に失敗しました";
        throw new Error(data.detail ? `${msg}\n${data.detail}` : msg);
      }
      if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
        throw new Error("AI返信候補を取得できませんでした");
      }
      setAiCandidates(
        data.candidates.map((c) => `【${c.label}】\n${c.text}`)
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  }

  // ── 料金プリセット読み込み ──────────────────────────────
  useEffect(() => {
    setPricePresets(loadPricePresets());
  }, []);

  // ── データ取得 ──────────────────────────────────────────
  useEffect(() => {
    // 顧客が切り替わったら編集済みフラグをリセットして新顧客の下書きを注入できるようにする
    setIsLineEdited(false);

    if (isNaN(customerId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/customers/${customerId}`).then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json() as Promise<CustomerDetail>;
      }),
      fetch(`/api/customers/${customerId}/messages`).then((r) => r.json() as Promise<DbMessage[]>),
    ]).then(([c, msgs]) => {
      if (c) {
        setCustomer(c);
        setStatus(c.status);
        setTags(c.tags ?? []);
        setNotes(c.notes ?? "");
        set_line_user_id(c.line_user_id ?? "");
        set_line_user_id_draft(c.line_user_id ?? "");
        setActions(c.actions ?? []);
        const draft = getCustomerMessageDraft(customerId);
        console.log("[lineMessage set]", "init", JSON.stringify(draft), "customerId=", customerId);
        setLineMessageState(draft);
        // 初回ロード時は常に下書きを注入する（直上で isLineEdited をリセット済み）
        setLineInjectKey((k) => k + 1);
      }
      setDbMessages(msgs ?? []);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [customerId]);

  // ── 返信送信 ─────────────────────────────────────────────
  async function sendReply() {
    const text = replyText.trim();
    if (!text) return;
    setReplySending(true);
    setReplyError(null);
    setReplySuccess(false);
    try {
      const res = await fetch(`/api/customers/${customerId}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "送信に失敗しました");
      }
      const saved: DbMessage = await res.json();
      setDbMessages((prev) => [...prev, saved]);
      setReplyText("");
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 3000);
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "送信に失敗しました。もう一度お試しください。");
    } finally {
      setReplySending(false);
    }
  }

  // ── API 経由でタグを保存 ────────────────────────────────
  async function saveTags() {
    setSavingTags(true);
    await fetch(`/api/customers/${customerId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tags }),
    });
    setSavingTags(false);
  }

  // ── ステータス保存 ───────────────────────────────────────
  async function saveStatus() {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setCustomer((prev) => prev ? { ...prev, status } : null);
    } catch (e) {
      console.error("[saveStatus]", e);
    } finally {
      setSavingStatus(false);
    }
  }

  // ── メモ保存 ─────────────────────────────────────────────
  async function saveNotes() {
    setSavingNotes(true);
    try {
      await fetch(`/api/customers/${customerId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ notes }),
      });
      setCustomer((prev) => prev ? { ...prev, notes } : null);
      setEditNotes(false);
    } catch (e) {
      console.error("[saveNotes]", e);
    } finally {
      setSavingNotes(false);
    }
  }

  // ── 顧客削除 ─────────────────────────────────────────────
  async function deleteCustomer() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "削除に失敗しました");
      }
      router.push("/customers");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "削除に失敗しました");
      setDeleting(false);
    }
  }

  // ── LINE ID 保存 ─────────────────────────────────────────────
  async function save_line_user_id() {
    setSavingLineId(true);
    await fetch(`/api/customers/${customerId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ line_user_id: line_user_id_draft }),
    });
    set_line_user_id(line_user_id_draft);
    setEditLineId(false);
    setSavingLineId(false);
  }

  // ── 返信候補（安定した参照を保つことで ReplyCandidatesPanel の自動選択が正しく動く）
  const replyCandidates = useMemo(
    () => aiCandidates ?? generateReplyCandidates(tags),
    [aiCandidates, tags]
  );

  // ── 顧客フェーズ（CTA文言の切り替えに使う）
  const customerPhase = useMemo(
    () => resolvePhase({
      tags,
      funnel_stage: customer?.funnel_stage,
      purchases:    customer?.purchases,
      category:     customer?.category,
      temperature:  customer?.temperature,
    }),
    [tags, customer?.funnel_stage, customer?.purchases, customer?.category, customer?.temperature]
  );

  // ── ローディング / エラー ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm text-gray-400">読み込み中...</span>
      </div>
    );
  }
  if (notFound || !customer) {
    return (
      <div className="space-y-4">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          顧客一覧に戻る
        </Link>
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400">顧客が見つかりませんでした</p>
        </div>
      </div>
    );
  }

  const tagsChanged = JSON.stringify(tags) !== JSON.stringify(customer.tags);

  return (
    <div className="space-y-4 pb-10">
      {/* 編集モーダル */}
      {showEditModal && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setCustomer((prev) => prev ? { ...prev, ...updated } : null);
            setShowEditModal(false);
          }}
        />
      )}

      {/* 戻るリンク */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        顧客一覧に戻る
      </Link>

      {/* ── ヘッダーカード ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-brand-500 via-pink-500 to-brand-400" />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* アバター: LINE プロフィール画像 or イニシャル */}
              {customer.line_user_id && (customer as CustomerDetail & { picture_url?: string }).picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(customer as CustomerDetail & { picture_url?: string }).picture_url}
                  alt={customer.name}
                  className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 shadow-md shadow-brand-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-300 to-pink-300 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-200">
                  <span className="text-2xl font-bold text-white">{customer.name[0]}</span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
                  <span className="text-sm text-gray-400">{customer.display_name}</span>
                  {customer.line_user_id && (
                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">
                      LINE連携済
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="purple" size="sm">{customer.category}</Badge>
                  <StatusBadge status={status} />
                  {customer.contact && (
                    <span className="text-xs text-gray-400">{customer.contact}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                編集
              </button>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-red-400 border border-red-100 px-3 py-2 rounded-lg hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  削除
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-red-600 font-medium">本当に削除しますか？</span>
                  <button
                    onClick={deleteCustomer}
                    disabled={deleting}
                    className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "削除中..." : "はい"}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                    disabled={deleting}
                    className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>
            {deleteError && (
              <p className="text-xs text-red-500 mt-1 w-full text-right">{deleteError}</p>
            )}
          </div>

          {/* ステータス変更 */}
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-[11px] text-gray-400 mb-2 font-semibold uppercase tracking-wider">ステータス変更</p>
            <StatusPicker
              value={status}
              onChange={setStatus}
              unsaved={status !== customer.status}
            />
            {status !== customer.status && (
              <button
                onClick={saveStatus}
                disabled={savingStatus}
                className="mt-2 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {savingStatus ? "保存中…" : "ステータスを保存"}
              </button>
            )}
          </div>

          {/* クイック統計 */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: "最終接触",       value: customer.last_contact },
              { label: "次回アクション", value: customer.next_action ?? "未設定",
                highlight: customer.next_action ? new Date(customer.next_action) <= new Date() : false },
              { label: "累計購入額",     value: `¥${customer.total_amount.toLocaleString()}`, bold: true },
              { label: "受信メッセージ", value: `${dbMessages.length} 件` },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className={`text-sm font-semibold ${
                  s.highlight ? "text-red-600" : s.bold ? "text-brand-600" : "text-gray-800"
                }`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ファネル進行 */}
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-[11px] text-gray-400 mb-3 font-semibold uppercase tracking-wider">ファネル進行</p>
            <div className="flex items-center gap-0">
              {FUNNEL_STEPS.map((step, i) => {
                const done    = i + 1 < customer.funnel_stage;
                const current = i + 1 === customer.funnel_stage;
                return (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      current ? "bg-brand-600 text-white shadow-sm shadow-brand-300"
                      : done   ? "bg-brand-100 text-brand-600"
                               : "bg-gray-100 text-gray-400"
                    }`}>
                      {done && <span className="text-[10px]">✓</span>}
                      {step}
                    </div>
                    {i < FUNNEL_STEPS.length - 1 && (
                      <div className={`w-6 h-0.5 ${i + 1 < customer.funnel_stage ? "bg-brand-300" : "bg-gray-100"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2カラムレイアウト ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 左カラム（2/3） */}
        <div className="lg:col-span-2 space-y-4">

          {/* 相談内容 */}
          {customer.consultation && (
            <SectionCard title="相談内容">
              <p className="text-sm text-gray-700 leading-relaxed">{customer.consultation}</p>
            </SectionCard>
          )}

          {/* 鑑定ヒアリング情報 */}
          <SectionCard title="鑑定ヒアリング情報">
            <InterviewPanel
              customerId={customer.id}
              currentTags={tags}
              onTagsChange={async (newTags) => {
                setTags(newTags);
                await fetch(`/api/customers/${customer.id}`, {
                  method:  "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ tags: newTags }),
                });
              }}
            />
          </SectionCard>

          {/* メッセージ履歴（DBから） */}
          <SectionCard title="メッセージ履歴">
            <LineMessageHistory messages={dbMessages} />
            <div className="mt-4 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                rows={3}
                placeholder="返信を入力… (Ctrl+Enter で送信)"
                disabled={replySending}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none disabled:opacity-50"
              />
              {replyError && (
                <p className="text-xs text-red-500 font-medium">{replyError}</p>
              )}
              {replySuccess && (
                <p className="text-xs text-green-600 font-medium">✓ LINEに送信しました</p>
              )}
              <button
                onClick={sendReply}
                disabled={replySending || !replyText.trim()}
                className="w-full py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                {replySending ? "送信中…" : "送信"}
              </button>
            </div>
          </SectionCard>

          {/* 受信メッセージ → キーワード自動判定（手動入力） */}
          <SectionCard title="受信メッセージ（手動テスト用）">
            <ReceivedMessagePanel
              customerId={customer.id}
              tags={tags}
              onTagsChange={setTags}
              onActionAdded={(entry) => setActions((prev) => [entry, ...prev])}
              onScenarioQueued={() => setScenarioRefreshKey((k) => k + 1)}
            />
          </SectionCard>

          {/* LINE 送信パネル */}
          <SectionCard title="LINE 送信">
            <LineSendPanel
              customerId={customer.id}
              line_user_id={line_user_id || undefined}
              onToneChange={setLineTone}
              customerTags={tags}
              customerStatus={status}
              onSent={(entry) => {
                setActions((prev) => [entry, ...prev]);
                // 次回アクション日が記録されていれば customer state にも反映（表示を即時更新）
                if (entry.nextAction) {
                  setCustomer((prev) => prev ? { ...prev, next_action: entry.nextAction ?? null } : null);
                }
                // 送信成功後、下書きをクリアして編集済みフラグをリセット
                // setLineMessage は使わず直接更新（isLineEdited が true でも確実にクリアするため）
                console.log("[lineMessage set]", "send-complete", '""');
                setLineMessageState("");
                saveCustomerMessageDraft(customerId, "");
                setIsLineEdited(false);
              }}
              injectText={lineMessage}
              injectKey={lineInjectKey}
              customerPhase={customerPhase}
              onEdit={(text) => {
                // ユーザーが LINE送信欄を手動編集（空クリア含む）したとき:
                // 1. 編集済みフラグを立てる（以降の自動上書きを全てブロック）
                // 2. page 側の lineMessage と localStorage を即時同期する
                //    → これがないと「空にしてもリロード時に戻る」バグが発生する
                console.log("[lineMessage set]", "line-panel-edit", JSON.stringify(text));
                setIsLineEdited(true);
                setLineMessageState(text);
                saveCustomerMessageDraft(customerId, text);
              }}
            />
          </SectionCard>

          {/* アクション履歴（手動記録分） */}
          {actions.length > 0 && (
            <SectionCard title="アクション履歴">
              <ol className="relative border-l border-gray-100 ml-2 space-y-4">
                {actions.map((a) => (
                  <li key={a.id} className="ml-5">
                    <span className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-white border-2 border-brand-300 mt-0.5" />
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTION_TYPE_STYLE[a.type]}`}>
                        {a.type}
                      </span>
                      <span className="text-[11px] text-gray-400">{a.date}</span>
                      {a.selectedTone && (
                        <span className="text-[10px] text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">
                          {a.selectedTone}
                        </span>
                      )}
                      {a.replyIntent && (
                        <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-100">
                          {a.replyIntent}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-snug">{a.note}</p>
                    {a.nextAction && (
                      <p className="text-[11px] text-amber-600 mt-0.5">次回: {a.nextAction}</p>
                    )}
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}

          {/* 鑑定本文保存 */}
          <SectionCard title="鑑定本文（手動鑑定メモ）">
            <DiagnosisPanel
              customerId={customer.id}
              customerName={customer.name}
              tags={tags}
            />
          </SectionCard>

          {/* メモ */}
          <SectionCard
            title="メモ"
            action={
              !editNotes ? (
                <button
                  onClick={() => setEditNotes(true)}
                  className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                >
                  編集
                </button>
              ) : null
            }
          >
            {editNotes ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setNotes(customer.notes ?? ""); setEditNotes(false); }}
                    disabled={savingNotes}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="flex-1 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {savingNotes ? "保存中…" : "保存"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {notes || <span className="text-gray-300">メモなし</span>}
              </p>
            )}
          </SectionCard>
        </div>

        {/* 右カラム（1/3） */}
        <div className="space-y-4">

          {/* 現在ステータス */}
          <SectionCard title="現在ステータス">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-gray-400 mb-2 font-semibold uppercase tracking-wider">危機度</p>
                <CrisisDots level={customer.crisis_level} />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-2 font-semibold uppercase tracking-wider">温度感</p>
                <TempBadge temp={customer.temperature} />
              </div>

              {/* LINE ユーザーID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">LINE ID</p>
                  {!editLineId && (
                    <button
                      onClick={() => { set_line_user_id_draft(line_user_id); setEditLineId(true); }}
                      className="text-[11px] text-gray-400 hover:text-brand-600 transition-colors"
                    >
                      編集
                    </button>
                  )}
                </div>
                {editLineId ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={line_user_id_draft}
                      onChange={(e) => set_line_user_id_draft(e.target.value)}
                      placeholder="Uxxxxxxxxxxxxxxxxx..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { set_line_user_id_draft(line_user_id); setEditLineId(false); }}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:border-gray-300 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={save_line_user_id}
                        disabled={savingLineId}
                        className="flex-1 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                      >
                        {savingLineId ? "保存中…" : "保存"}
                      </button>
                    </div>
                  </div>
                ) : line_user_id ? (
                  <p className="text-xs font-mono text-gray-700 break-all">{line_user_id}</p>
                ) : (
                  <p className="text-xs text-gray-300">未設定（LINE Webhook で自動設定）</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 相手情報 */}
          {customer.partner && (
            <SectionCard title="相手情報">
              <div className="space-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">氏名・年齢</p>
                  <p className="text-sm font-medium text-gray-800">{customer.partner.name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">関係性</p>
                  <p className="text-sm text-gray-700">{customer.partner.relationship}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">状況</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{customer.partner.situation}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* タグ管理 */}
          <SectionCard
            title="タグ管理"
            action={
              tagsChanged ? (
                <button
                  onClick={saveTags}
                  disabled={savingTags}
                  className="text-xs bg-brand-600 text-white px-2.5 py-1 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {savingTags ? "保存中…" : "保存"}
                </button>
              ) : null
            }
          >
            <TagEditor
              value={tags}
              onChange={setTags}
              unsaved={tagsChanged}
            />
          </SectionCard>

          {/* 返信候補 */}
          <SectionCard
            title="返信候補"
            action={
              <div className="flex items-center gap-2">
                {aiCandidates && (
                  <button
                    onClick={() => { setAiCandidates(null); setAiError(null); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    リセット
                  </button>
                )}
                <button
                  onClick={generateAiReplies}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1 text-xs bg-brand-600 text-white px-2.5 py-1 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {aiLoading ? "生成中…" : "✨ このトーンで作成"}
                </button>
              </div>
            }
          >
            {aiError && (
              <p className="text-xs text-red-500 mb-2">{aiError}</p>
            )}
            <ReplyCandidatesPanel
              candidates={replyCandidates}
              onSelect={(text) => setLineMessage(text)}
              onAppend={(text) => appendLineMessage(text)}
              salesStartIndex={aiCandidates ? undefined : replyCandidates.length - 1}
            />
          </SectionCard>

          {/* おすすめ商品 */}
          <SectionCard title="おすすめ商品">
            <div className="space-y-3">
              <ProductSuggestionsPanel
                products={getRecommendedProducts(
                  {
                    tags,
                    funnel_stage: customer?.funnel_stage,
                    purchases: customer?.purchases,
                    category: customer?.category,
                    temperature: customer?.temperature,
                  },
                  pricePresets.length > 0 ? pricePresets : undefined,
                )}
                customerPhase={customerPhase}
                customerId={customerId}
              />
              <OfferMessagePanel
                message={generateOfferMessage(tags, pricePresets.length > 0 ? pricePresets : undefined)}
                onUse={(text) => setLineMessage(text)}
                onAppend={(text) => appendLineMessage(text)}
              />
            </div>
          </SectionCard>

          {/* 鑑定テンプレ提案 */}
          <SectionCard title="鑑定テンプレ提案">
            <DiagnosisTemplateSuggestionsPanel
              customerId={customer.id}
              tags={tags}
              concern={customer.consultation}
            />
          </SectionCard>

          {/* LINE 送信文ドラフト */}
          <SectionCard title="LINE 送信文ドラフト">
            <MessageDraftPanel
              customerName={customer.name}
              customerId={customer.id}
              tags={tags}
              value={lineMessage}
              onChange={handleDraftChange}
              tone={lineTone}
              lineUserId={line_user_id || undefined}
            />
          </SectionCard>

          {/* 教育シナリオ予定（DB管理） */}
          <SectionCard title="シナリオ予定">
            <EducationScenarioPanel customerId={customer.id} />
          </SectionCard>

          {/* タグトリガーシナリオ予定（localStorage） */}
          {scenarioRefreshKey >= 0 && (
            <SectionCard title="タグシナリオ予定">
              <ScenarioQueuePanel
                customerId={customer.id}
                refreshKey={scenarioRefreshKey}
              />
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── 購入履歴（全幅） ────────────────────────── */}
      {customer.purchases.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">購入履歴</h3>
            <span className="text-xs text-gray-400">
              合計 <span className="text-brand-600 font-semibold">¥{customer.total_amount.toLocaleString()}</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["日付", "メニュー", "金額", "支払"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customer.purchases.map((p) => (
                  <PurchaseRow key={p.id} purchase={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PurchaseRow({ purchase: p }: { purchase: Purchase }) {
  const product = getProduct(p.product_id);
  return (
    <tr className="hover:bg-gray-50/60 transition-colors">
      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{p.date}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {product && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${product.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${product.dotClass}`} />
              {product.label}
            </span>
          )}
          {p.note && <span className="text-xs text-gray-500">{p.note}</span>}
          {p.price === 0 && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">無料</span>
          )}
        </div>
      </td>
      <td className="px-5 py-3">
        {p.price === 0 ? (
          <span className="text-sm text-gray-400">¥0</span>
        ) : (
          <span className="text-sm font-semibold text-gray-800">¥{p.price.toLocaleString()}</span>
        )}
      </td>
      <td className="px-5 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          p.paid ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                 : "bg-red-50 text-red-600 border border-red-100"
        }`}>
          {p.paid ? "✓ 済" : "未払"}
        </span>
      </td>
    </tr>
  );
}
