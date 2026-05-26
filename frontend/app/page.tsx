"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import type { CardItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import PredictionCard from "@/components/prediction-card";

export default function FeedPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [category, setCategory] = useState("전체");
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "open" });
      if (category !== "전체") params.set("category", category);
      const data = await api.get<{ items: CardItem[] }>(`/cards?${params}`, token);
      setCards(data.items);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [category, token]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const THRESHOLD = 80;

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (refreshing) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) {
      setPullY(Math.min(dy * 0.4, 120));
    }
  }

  async function onTouchEnd() {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      await loadCards();
      setRefreshing(false);
    }
    setPullY(0);
    touchStartY.current = 0;
  }

  async function handleVote(cardId: string, choice: string) {
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const res = await api.post<{
        choice: string;
        card: { yes_count: number; no_count: number; yes_ratio: number; choice_counts: Record<string, number> };
      }>(`/cards/${cardId}/vote`, { choice }, token);
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, my_vote: res.choice, yes_count: res.card.yes_count, no_count: res.card.no_count, yes_ratio: res.card.yes_ratio, choice_counts: res.card.choice_counts }
            : c
        ),
      );
    } catch (e) {
      if (e instanceof ApiError) {
        alert(e.message);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 헤더 */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.08] bg-[#0b0a18]/95 px-4 py-3 backdrop-blur">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <img src="/icon.png" alt="촉" className="h-8 rounded-lg" />
          <span className="text-purple-300">촉(Chok)</span>
        </h1>
        {token && user?.nickname && (
          <span className="text-sm font-medium text-jd-muted">{user.nickname}</span>
        )}
      </header>

      {/* 카테고리 필터 */}
      <div className="sticky top-[49px] z-30 flex gap-2 overflow-x-auto border-b border-white/[0.08] bg-[#0b0a18]/95 px-4 py-3 backdrop-blur scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              category === cat ? "bg-jd-accent text-white" : "bg-white/[0.06] text-jd-muted hover:text-white/80",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Pull-to-refresh 인디케이터 */}
      {pullY > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: pullY }}
        >
          <div className={cn(
            "text-xs text-jd-muted transition-opacity",
            pullY >= THRESHOLD ? "text-jd-accent opacity-100" : "opacity-60",
          )}>
            {pullY >= THRESHOLD ? "놓으면 새로고침" : "당겨서 새로고침"}
          </div>
        </div>
      )}
      {refreshing && (
        <div className="flex items-center justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-jd-accent border-t-transparent" />
        </div>
      )}

      {/* 카드 피드 */}
      <div className="space-y-4 px-4 pt-4 pb-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-white/[0.04]" />
          ))
        ) : cards.length === 0 ? (
          <div className="py-20 text-center text-jd-muted">
            <p className="text-lg">아직 예측 카드가 없습니다</p>
            <p className="mt-1 text-sm">곧 새로운 예측이 올라올 거예요!</p>
          </div>
        ) : (
          cards.map((card) => <PredictionCard key={card.id} card={card} token={token} onVote={handleVote} />)
        )}
      </div>
    </div>
  );
}
