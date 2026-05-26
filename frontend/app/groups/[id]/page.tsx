"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, Share2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn, timeLeft, pct } from "@/lib/utils";
import Link from "next/link";

interface GroupDetail {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  role: string;
  members: { user_id: string; nickname: string | null; role: string }[];
}

interface GroupRankItem {
  rank: number;
  user_id: string;
  nickname: string | null;
  score: number;
  wins: number;
  votes: number;
  win_rate: number;
}

interface MemberResult {
  user_id: string;
  nickname: string;
  choice: string;
  hit: boolean;
}

interface GroupCard {
  id: string;
  title: string;
  category: string;
  status: string;
  card_type: string;
  choices: string[];
  yes_count: number;
  no_count: number;
  choice_counts: Record<string, number>;
  closes_at: string;
  result_announce_at: string | null;
  final_result: string | null;
  my_vote: string | null;
  creator_nickname: string | null;
  is_mine: boolean;
  member_results: MemberResult[];
}

export default function GroupFeedPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user: authUser } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [cards, setCards] = useState<GroupCard[]>([]);
  const [ranking, setRanking] = useState<GroupRankItem[]>([]);
  const [tab, setTab] = useState<"feed" | "ranking">("feed");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [settleResult, setSettleResult] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const loadData = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [g, c, r] = await Promise.all([
        api.get<GroupDetail>(`/groups/${id}`, token),
        api.get<{ items: GroupCard[] }>(`/groups/${id}/cards`, token),
        api.get<{ items: GroupRankItem[] }>(`/groups/${id}/leaderboard`, token),
      ]);
      setGroup(g);
      setCards(c.items);
      setRanking(r.items);
    } catch {
      router.push("/groups");
    } finally {
      setLoading(false);
    }
  }, [token, id, router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleVote(cardId: string, choice: string) {
    try {
      await api.post(`/groups/${id}/cards/${cardId}/vote`, { choice }, token);
      loadData();
    } catch (e) {
      if (e instanceof ApiError) alert(e.message);
    }
  }

  async function handleClose(cardId: string) {
    if (!confirm("이 예측을 조기 마감하시겠습니까?")) return;
    try {
      await api.post(`/groups/${id}/cards/${cardId}/close`, {}, token);
      loadData();
    } catch (e) {
      if (e instanceof ApiError) alert(e.message);
    }
  }

  async function handleSettle(cardId: string) {
    const result = settleResult[cardId];
    if (!result) return;
    try {
      await api.post(`/groups/${id}/cards/${cardId}/settle`, { result }, token);
      loadData();
    } catch (e) {
      if (e instanceof ApiError) alert(e.message);
    }
  }

  async function handleRename() {
    if (!newName.trim()) return;
    try {
      await api.patch(`/groups/${id}`, { name: newName.trim() }, token);
      setEditingName(false);
      loadData();
    } catch (e) {
      if (e instanceof ApiError) alert(e.message);
    }
  }

  async function shareCode() {
    if (!group) return;
    const text = `촉앤톡(Chok&Talk)에 초대합니다!\n방 이름: ${group.name}\n초대 코드: ${group.invite_code}\n\n앱에서 [촉앤톡] → [코드로 참여]를 눌러 입력하세요!`;
    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";

    if (isSecure && navigator.share) {
      try {
        await navigator.share({ title: `촉앤톡 - ${group.name}`, text });
        return;
      } catch {
        // 사용자 취소 — 클립보드 복사로 폴백
      }
    }
    try {
      await navigator.clipboard.writeText(group.invite_code);
    } catch {
      window.prompt("초대 코드를 복사하세요:", group.invite_code);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !group) {
    return <div className="flex min-h-dvh items-center justify-center text-jd-muted">로딩 중...</div>;
  }

  return (
    <div className="pb-20">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0b0a18]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/groups")} className="text-jd-muted hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRename(); }}
                  maxLength={50}
                  autoFocus
                  className="flex-1 rounded border border-jd-accent/50 bg-white/[0.06] px-2 py-1 text-sm text-white outline-none"
                />
                <button onClick={handleRename} className="text-xs font-semibold text-jd-accent">확인</button>
                <button onClick={() => setEditingName(false)} className="text-xs text-jd-muted">취소</button>
              </div>
            ) : (
              <h1
                className={cn("truncate text-base font-bold", group.role === "owner" && "cursor-pointer")}
                onClick={() => { if (group.role === "owner") { setNewName(group.name); setEditingName(true); } }}
              >
                {group.name}
                {group.role === "owner" && <span className="ml-1 text-[10px] text-jd-muted">✎</span>}
              </h1>
            )}
            <p className="text-xs text-jd-muted"><Users size={11} className="mr-1 inline" />{group.member_count}명</p>
          </div>
          <button
            onClick={shareCode}
            className="flex items-center gap-1.5 rounded-lg bg-jd-accent/15 px-3 py-1.5 text-xs font-semibold text-jd-accent transition hover:bg-jd-accent/25"
          >
            {copied ? <Check size={13} className="text-jd-yes" /> : <Share2 size={13} />}
            {copied ? "코드 복사됨!" : "초대하기"}
          </button>
        </div>
        {/* 탭 */}
        <div className="mt-4 flex gap-1">
          <button
            onClick={() => setTab("feed")}
            className={cn("flex-1 rounded-lg py-2.5 text-sm font-medium transition", tab === "feed" ? "bg-jd-accent text-white" : "text-jd-muted hover:bg-white/[0.04]")}
          >
            예측 피드
          </button>
          <button
            onClick={() => setTab("ranking")}
            className={cn("flex-1 rounded-lg py-2.5 text-sm font-medium transition", tab === "ranking" ? "bg-jd-accent text-white" : "text-jd-muted hover:bg-white/[0.04]")}
          >
            🏆 적중률 순위
          </button>
        </div>
      </header>

      {tab === "feed" ? (
        <>
          {/* 출제 버튼 */}
          <div className="px-4 pt-4">
            <Link
              href={`/groups/${id}/create`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-jd-accent/40 py-3 text-sm font-semibold text-jd-accent transition hover:bg-jd-accent/10"
            >
              <Plus size={16} /> 예측 문제 출제하기
            </Link>
          </div>

          {/* 카드 피드 */}
          <div className="space-y-4 px-4 pt-4">
            {cards.length === 0 ? (
              <div className="py-16 text-center text-jd-muted">
                <p className="text-lg">아직 예측이 없습니다</p>
                <p className="mt-1 text-sm">첫 번째 예측 문제를 출제해보세요!</p>
              </div>
            ) : (
              cards.map((card) => (
                <GroupCardItem
                  key={card.id}
                  card={card}
                  currentUserId={authUser?.id}
                  isOwner={group.role === "owner"}
                  onVote={handleVote}
                  onClose={handleClose}
                  onSettle={handleSettle}
                  settleResult={settleResult}
                  setSettleResult={setSettleResult}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <GroupRanking ranking={ranking} currentUserId={authUser?.id} />
      )}
    </div>
  );
}

function GroupCardItem({
  card,
  currentUserId,
  isOwner,
  onVote,
  onClose,
  onSettle,
  settleResult,
  setSettleResult,
}: {
  card: GroupCard;
  currentUserId: string | undefined;
  isOwner: boolean;
  onVote: (cardId: string, choice: string) => void;
  onClose: (cardId: string) => void;
  onSettle: (cardId: string) => void;
  settleResult: Record<string, string>;
  setSettleResult: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const remaining = timeLeft(card.closes_at);
  const closed = card.status !== "open" || remaining === "마감됨";
  const isSettled = card.status === "settled";
  const choices = card.choices || ["YES", "NO"];
  const counts = card.choice_counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (isSettled && !expanded) {
    const myResult = card.member_results.find((m) => m.user_id === currentUserId);
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 text-left transition active:scale-[0.98] hover:bg-white/[0.06]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jd-yes/15 text-sm text-jd-yes">✓</span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm text-white/70">{card.title}</p>
          <p className="mt-0.5 text-xs text-jd-muted">
            정답: <span className="font-semibold text-jd-yes">{card.final_result}</span>
            {myResult && (
              <span className={cn("ml-2", myResult.hit ? "text-jd-yes" : "text-jd-no")}>
                {myResult.hit ? "적중!" : "실패"}
              </span>
            )}
          </p>
        </div>
        <span className="text-sm text-white/30">▼</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.10] via-white/[0.05] to-transparent p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-jd-muted">{card.creator_nickname ?? "익명"} 출제</span>
        <span className={cn("text-xs", isSettled ? "text-jd-yes" : closed ? "text-jd-no" : "text-gray-300")}>
          {isSettled ? "정산 완료" : remaining}
        </span>
      </div>
      <p className="mb-3 text-[15px] font-semibold leading-snug text-white">{card.title}</p>

      {card.result_announce_at && !isSettled && (
        <p className="mb-3 text-center text-xs text-gray-300">
          결과 발표 {new Date(card.result_announce_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      )}

      {/* 선택지 */}
      <div className="space-y-2">
        {choices.map((choice) => {
          const count = counts[choice] || 0;
          const ratio = total > 0 ? count / total : 0;
          const isMyVote = card.my_vote === choice;
          const isAnswer = isSettled && card.final_result === choice;

          if (closed || card.my_vote) {
            return (
              <div key={choice} className={cn(
                "relative overflow-hidden rounded-lg px-4 py-2.5",
                isAnswer ? "ring-1 ring-jd-yes/60" : isMyVote ? "ring-1 ring-jd-accent/50" : "bg-white/[0.04]",
              )}>
                <div className={cn(
                  "absolute inset-y-0 left-0 transition-all",
                  isAnswer ? "bg-jd-yes opacity-15" : isMyVote ? "bg-jd-accent opacity-15" : "bg-white opacity-5",
                )} style={{ width: pct(ratio) }} />
                <div className="relative flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", isAnswer ? "text-jd-yes" : isMyVote ? "text-white" : "text-white/50")}>
                    {isAnswer && "✓ "}{choice}
                  </span>
                  <span className={cn("text-xs", isMyVote || isAnswer ? "text-white/80" : "text-white/40")}>{pct(ratio)}</span>
                </div>
              </div>
            );
          }

          return (
            <button
              key={choice}
              onClick={() => onVote(card.id, choice)}
              className="w-full rounded-lg bg-white/[0.04] px-4 py-2.5 text-left text-sm font-semibold text-white/90 transition hover:bg-white/[0.08] active:scale-[0.98]"
            >
              {choice}
            </button>
          );
        })}
      </div>

      {/* 정산 완료 — 멤버별 결과 */}
      {isSettled && card.member_results.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold text-white/60">참여 멤버 결과</p>
          <div className="space-y-1.5">
            {card.member_results.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2">
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  m.hit ? "bg-jd-yes/20 text-jd-yes" : "bg-jd-no/20 text-jd-no",
                )}>
                  {m.hit ? "✓" : "✗"}
                </span>
                <span className={cn(
                  "flex-1 truncate text-sm",
                  m.user_id === currentUserId ? "font-semibold text-white" : "text-white/70",
                )}>
                  {m.nickname}{m.user_id === currentUserId ? " (나)" : ""}
                </span>
                <span className={cn("text-xs", m.hit ? "text-jd-yes" : "text-jd-no")}>
                  {m.choice}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 출제자 조기 마감 */}
      {card.is_mine && card.status === "open" && !closed && (
        <button
          onClick={() => onClose(card.id)}
          className="mt-3 w-full rounded-lg border border-jd-no/30 py-2 text-xs font-semibold text-jd-no transition hover:bg-jd-no/10"
        >
          조기 마감
        </button>
      )}

      {/* 출제자 정답 입력 */}
      {(card.is_mine || isOwner) && !isSettled && closed && (
        <div className="mt-3 flex gap-2">
          <select
            value={settleResult[card.id] || ""}
            onChange={(e) => setSettleResult((p) => ({ ...p, [card.id]: e.target.value }))}
            className="flex-1 rounded-lg border border-white/[0.1] bg-[#1a1a2e] px-3 py-2 text-sm text-white outline-none"
          >
            <option value="" style={{ background: "#1a1a2e", color: "#ccc" }}>정답 선택</option>
            {choices.map((c) => <option key={c} value={c} style={{ background: "#1a1a2e", color: "#fff" }}>{c}</option>)}
            <option value="VOID" style={{ background: "#1a1a2e", color: "#f87171" }}>VOID (무효)</option>
          </select>
          <button
            onClick={() => onSettle(card.id)}
            disabled={!settleResult[card.id]}
            className="rounded-lg bg-jd-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            정산
          </button>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-jd-muted">{total}명 참여</p>

      {isSettled && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 w-full rounded-lg bg-white/[0.04] py-2.5 text-xs font-medium text-jd-muted transition active:scale-[0.98] hover:bg-white/[0.06]"
        >
          ▲ 접기
        </button>
      )}
    </div>
  );
}

function GroupRanking({
  ranking,
  currentUserId,
}: {
  ranking: GroupRankItem[];
  currentUserId: string | undefined;
}) {
  const active = ranking.filter((r) => r.votes > 0);
  const top3 = active.slice(0, 3);
  const myIdx = active.findIndex((r) => r.user_id === currentUserId);
  const myRank = myIdx >= 0 ? active[myIdx] : null;

  if (active.length === 0) {
    return (
      <div className="px-4 pt-8 pb-4 text-center text-jd-muted">
        <p className="text-lg">🏆</p>
        <p className="mt-2 text-sm">아직 정산된 예측이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      {/* TOP 3 포디움 */}
      <div className="mb-4 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-jd-accent/10 via-white/[0.04] to-transparent p-5">
        <div className="flex items-end justify-center gap-4">
          {[1, 0, 2].map((pos) => {
            const r = top3[pos];
            if (!r) return <div key={pos} className="w-20" />;
            const isMe = r.user_id === currentUserId;
            const isFirst = pos === 0;
            return (
              <div key={r.user_id} className={cn("flex flex-col items-center", isFirst ? "order-1" : pos === 1 ? "order-0" : "order-2")}>
                <span className={cn("mb-1 font-black text-jd-pq", isFirst ? "text-2xl" : "text-lg")}>{pos + 1}</span>
                <div className={cn(
                  "flex items-center justify-center rounded-full font-bold",
                  isFirst ? "h-14 w-14 text-sm" : "h-11 w-11 text-xs",
                  isMe ? "bg-jd-accent text-white ring-2 ring-jd-accent/50" : "bg-white/[0.08] text-white/70",
                )}>
                  {Math.round(r.win_rate * 100)}%
                </div>
                <p className={cn("mt-1.5 w-18 truncate text-center text-xs", isMe ? "font-bold text-jd-accent" : "text-white/60")}>
                  {r.nickname ?? "익명"}
                </p>
                <p className="text-[10px] text-jd-muted">{r.wins}승 {r.votes}전</p>
              </div>
            );
          })}
        </div>

        {myRank && myIdx >= 3 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-jd-accent/10 border border-jd-accent/30 px-3 py-2.5">
            <span className="text-sm font-bold text-jd-accent">{myIdx + 1}위</span>
            <span className="flex-1 truncate text-sm text-white/80">{myRank.nickname ?? "익명"} (나)</span>
            <span className="text-sm font-bold text-jd-pq">{Math.round(myRank.win_rate * 100)}%</span>
            <span className="text-xs text-jd-muted">{myRank.wins}/{myRank.votes}</span>
          </div>
        )}
      </div>

      {/* 전체 순위 리스트 */}
      <div className="space-y-1.5">
        {active.map((r, i) => {
          const isMe = r.user_id === currentUserId;
          return (
            <div key={r.user_id} className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              isMe ? "bg-jd-accent/10 border border-jd-accent/30" : "bg-white/[0.03]",
            )}>
              <span className="w-7 text-center text-sm font-bold">
                <span className={cn(i <= 2 ? "text-jd-pq" : "text-jd-muted")}>{i + 1}</span>
              </span>
              <span className={cn("flex-1 truncate text-sm", isMe ? "font-semibold text-white" : "text-white/60")}>
                {r.nickname ?? "익명"}{isMe ? " (나)" : ""}
              </span>
              <span className="text-sm font-bold text-jd-pq">{Math.round(r.win_rate * 100)}%</span>
              <span className="w-12 text-right text-xs text-jd-muted">{r.wins}/{r.votes}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
