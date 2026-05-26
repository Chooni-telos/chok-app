"use client";

import { useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { cn, timeLeft, pct } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { CardItem, CommentItem } from "@/lib/types";

interface Props {
  card: CardItem;
  token: string | null;
  onVote: (cardId: string, choice: string) => void;
}

const CAT_COLORS: Record<string, string> = {
  시사: "bg-blue-500/15 text-blue-300",
  스포츠: "bg-green-500/15 text-green-300",
  엔터테인먼트: "bg-pink-500/15 text-pink-300",
  경제테크: "bg-amber-500/15 text-amber-300",
  도파민: "bg-purple-500/15 text-purple-300",
};

const CHOICE_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-purple-500",
];

export default function PredictionCard({ card, token, onVote }: Props) {
  const isMulti = card.card_type === "multichoice";
  const counts = card.choice_counts || {};
  const total = isMulti
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : card.yes_count + card.no_count;
  const remaining = timeLeft(card.closes_at);
  const closed = card.status !== "open" || remaining === "마감됨";

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentCount, setCommentCount] = useState(card.comment_count);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  async function toggleComments() {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    setLoadingComments(true);
    try {
      const res = await api.get<{ items: CommentItem[]; total: number }>(
        `/cards/${card.id}/comments`,
        token
      );
      setComments(res.items);
      setCommentCount(res.total);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitComment() {
    if (!newComment.trim() || !token) return;
    try {
      await api.post(`/cards/${card.id}/comments`, { content: newComment.trim() }, token);
      setNewComment("");
      const res = await api.get<{ items: CommentItem[]; total: number }>(
        `/cards/${card.id}/comments`,
        token
      );
      setComments(res.items);
      setCommentCount(res.total);
    } catch (e) {
      if (e instanceof ApiError) alert(e.message);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await api.del(`/cards/${card.id}/comments/${commentId}`, token);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      if (e instanceof ApiError) alert(e.message);
    }
  }

  function renderYesNoButtons() {
    const yesPct = total > 0 ? card.yes_ratio : 0.5;
    const hasVoted = !!card.my_vote;

    return (
      <>
        {hasVoted && (
          <>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium">
              <span className="text-jd-yes">YES {pct(yesPct)}</span>
              <span className="ml-auto text-jd-no">NO {pct(1 - yesPct)}</span>
            </div>
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="bg-jd-yes transition-all" style={{ width: pct(yesPct) }} />
              <div className="bg-jd-no transition-all" style={{ width: pct(1 - yesPct) }} />
            </div>
          </>
        )}

        <div className="mb-3 text-center text-xs text-gray-300">
          결과 발표 {new Date(card.result_announce_at || card.closes_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
        </div>

        {closed && !card.my_vote ? (
          <div className="rounded-lg bg-white/[0.04] py-2 text-center text-sm text-gray-300">
            {card.status === "settled" ? "정산 완료" : "결과 대기 중"}
          </div>
        ) : closed && card.my_vote ? (
          <div className="flex gap-4">
            <div className={cn("flex-1 rounded-lg py-2.5 text-center text-sm font-semibold", card.my_vote === "YES" ? "bg-jd-yes/15 text-jd-yes ring-1 ring-jd-yes/40" : "bg-white/[0.04] text-white/40")}>
              YES
            </div>
            <div className={cn("flex-1 rounded-lg py-2.5 text-center text-sm font-semibold", card.my_vote === "NO" ? "bg-jd-no/15 text-jd-no ring-1 ring-jd-no/40" : "bg-white/[0.04] text-white/40")}>
              NO
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={() => onVote(card.id, "YES")}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition active:scale-95",
                card.my_vote === "YES"
                  ? "bg-jd-yes/15 text-jd-yes ring-2 ring-jd-yes/50"
                  : card.my_vote === "NO"
                    ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.06] hover:text-white/50"
                    : "bg-jd-yes/15 text-jd-yes hover:bg-jd-yes/25"
              )}
            >
              YES
            </button>
            <button
              onClick={() => onVote(card.id, "NO")}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition active:scale-95",
                card.my_vote === "NO"
                  ? "bg-jd-no/15 text-jd-no ring-2 ring-jd-no/50"
                  : card.my_vote === "YES"
                    ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.06] hover:text-white/50"
                    : "bg-jd-no/15 text-jd-no hover:bg-jd-no/25"
              )}
            >
              NO
            </button>
          </div>
        )}
      </>
    );
  }

  function renderMultiChoiceButtons() {
    const choices = card.choices || [];
    const hasVoted = !!card.my_vote;
    const isBinary = choices.length === 2;

    if (isBinary) return renderBinaryButtons(choices);

    return (
      <>
        <div className="mb-3 text-center text-xs text-gray-300">
          결과 발표 {new Date(card.result_announce_at || card.closes_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
        </div>

        <div className="space-y-2">
          {choices.map((choice, idx) => {
            const count = counts[choice] || 0;
            const ratio = total > 0 ? count / total : 0;
            const isMyVote = card.my_vote === choice;
            const colorClass = CHOICE_COLORS[idx % CHOICE_COLORS.length];

            if (closed && !card.my_vote) {
              return (
                <div key={choice} className="rounded-lg bg-white/[0.04] px-4 py-2.5">
                  <span className="text-sm text-white/50">{choice}</span>
                </div>
              );
            }

            if (closed && card.my_vote) {
              return (
                <div key={choice} className={cn("relative overflow-hidden rounded-lg px-4 py-2.5", isMyVote ? "ring-2 ring-jd-accent/50" : "bg-white/[0.04]")}>
                  <div className={cn("absolute inset-y-0 left-0", isMyVote ? "opacity-20" : "opacity-10", colorClass)} style={{ width: pct(ratio) }} />
                  <div className="relative flex items-center justify-between">
                    <span className={cn("text-sm font-semibold", isMyVote ? "text-white" : "text-white/50")}>{choice}</span>
                    <span className={cn("text-xs", isMyVote ? "text-white/80" : "text-white/40")}>{pct(ratio)}</span>
                  </div>
                </div>
              );
            }

            if (!hasVoted) {
              return (
                <button
                  key={choice}
                  onClick={() => onVote(card.id, choice)}
                  className="w-full rounded-lg bg-white/[0.04] px-4 py-2.5 text-left text-sm font-semibold text-white/90 transition hover:bg-white/[0.08] active:scale-[0.98]"
                >
                  {choice}
                </button>
              );
            }

            return (
              <button
                key={choice}
                onClick={() => onVote(card.id, choice)}
                className={cn(
                  "relative w-full overflow-hidden rounded-lg px-4 py-2.5 text-left transition active:scale-[0.98]",
                  isMyVote ? "ring-2 ring-jd-accent/50" : "bg-white/[0.04] hover:bg-white/[0.08]"
                )}
              >
                <div className={cn("absolute inset-y-0 left-0 transition-all", isMyVote ? "opacity-20" : "opacity-10", colorClass)} style={{ width: pct(ratio) }} />
                <div className="relative flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", isMyVote ? "text-white" : "text-white/60")}>{choice}</span>
                  <span className={cn("text-xs", isMyVote ? "text-white/80" : "text-white/50")}>{pct(ratio)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {closed && !card.my_vote && (
          <div className="mt-2 rounded-lg bg-white/[0.04] py-2 text-center text-sm text-gray-300">
            {card.status === "settled" ? "정산 완료" : "결과 대기 중"}
          </div>
        )}
      </>
    );
  }

  function renderBinaryButtons(choices: string[]) {
    const [a, b] = choices;
    const countA = counts[a] || 0;
    const countB = counts[b] || 0;
    const ratioA = total > 0 ? countA / total : 0.5;
    const hasVoted = !!card.my_vote;
    const colorA = CHOICE_COLORS[0];
    const colorB = CHOICE_COLORS[1];

    return (
      <>
        {hasVoted && (
          <>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium">
              <span className="text-indigo-400">{a} {pct(ratioA)}</span>
              <span className="ml-auto text-emerald-400">{b} {pct(1 - ratioA)}</span>
            </div>
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className={cn("transition-all", colorA)} style={{ width: pct(ratioA) }} />
              <div className={cn("transition-all", colorB)} style={{ width: pct(1 - ratioA) }} />
            </div>
          </>
        )}

        <div className="mb-3 text-center text-xs text-gray-300">
          결과 발표 {new Date(card.result_announce_at || card.closes_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
        </div>

        {closed && !card.my_vote ? (
          <div className="rounded-lg bg-white/[0.04] py-2 text-center text-sm text-gray-300">
            {card.status === "settled" ? "정산 완료" : "결과 대기 중"}
          </div>
        ) : closed && card.my_vote ? (
          <div className="flex gap-4">
            <div className={cn("flex-1 rounded-lg py-2.5 text-center text-sm font-semibold", card.my_vote === a ? "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-400/40" : "bg-white/[0.04] text-white/40")}>
              {a}
            </div>
            <div className={cn("flex-1 rounded-lg py-2.5 text-center text-sm font-semibold", card.my_vote === b ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/40" : "bg-white/[0.04] text-white/40")}>
              {b}
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={() => onVote(card.id, a)}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition active:scale-95",
                card.my_vote === a
                  ? "bg-indigo-500/15 text-indigo-400 ring-2 ring-indigo-400/50"
                  : card.my_vote === b
                    ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.06] hover:text-white/50"
                    : "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25"
              )}
            >
              {a}
            </button>
            <button
              onClick={() => onVote(card.id, b)}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition active:scale-95",
                card.my_vote === b
                  ? "bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-400/50"
                  : card.my_vote === a
                    ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.06] hover:text-white/50"
                    : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              )}
            >
              {b}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-transparent shadow-xl shadow-purple-900/20 transition hover:border-white/[0.22] hover:from-white/[0.15]">
      <div className="p-4 pb-0">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CAT_COLORS[card.category] ?? "bg-slate-500/15 text-slate-300")}>
              {card.category}
            </span>
          </div>
          <span className={cn("text-xs", closed ? "text-jd-no" : "text-gray-300")}>{remaining}</span>
        </div>

        <p className="mb-3 text-[15px] font-semibold leading-snug text-white">{card.title}</p>
      </div>

      {card.image_url && (
        <div className="px-4">
          <div className="relative h-44 w-full overflow-hidden rounded-xl">
            <img src={card.image_url} alt={card.title} className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      <div className="p-4 pt-3">

        {isMulti ? renderMultiChoiceButtons() : renderYesNoButtons()}

        {/* 댓글 토글 */}
        <button
          onClick={toggleComments}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-jd-muted transition hover:bg-white/[0.04]"
        >
          <MessageCircle size={14} />
          댓글 {commentCount > 0 && <span className="font-semibold text-white/80">{commentCount}</span>}
        </button>

        {/* 댓글 섹션 */}
        {showComments && (
          <div className="mt-2 border-t border-white/[0.06] pt-3">
            {token && !comments.some((c) => c.is_mine) && (
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitComment(); }}
                  placeholder="한줄 댓글을 남겨보세요"
                  maxLength={200}
                  className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-white/50 outline-none focus:border-jd-accent focus:ring-1 focus:ring-jd-accent"
                />
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim()}
                  className="rounded-lg bg-jd-accent px-3 py-2 text-white transition hover:bg-jd-accent/80 disabled:opacity-30"
                >
                  <Send size={18} />
                </button>
              </div>
            )}

            {loadingComments ? (
              <p className="py-3 text-center text-xs text-jd-muted">로딩 중...</p>
            ) : comments.length === 0 ? (
              <p className="py-3 text-center text-xs text-jd-muted">아직 댓글이 없습니다</p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-white/80">{c.nickname ?? "익명"}</span>
                      <p className="text-xs leading-relaxed text-white/70">{c.content}</p>
                    </div>
                    {c.is_mine && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="shrink-0 rounded p-1 text-white/40 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
