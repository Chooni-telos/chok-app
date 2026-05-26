"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, LogOut, Settings, Target, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { LEVEL_LABELS, LEVEL_COLORS, LEVEL_BG_COLORS, LEVEL_RING_COLORS, LEVEL_DESC } from "@/lib/constants";
import { cn, pct } from "@/lib/utils";
import { TierOrb } from "@/components/tier-orb";
import type { VoteHistoryItem } from "@/lib/types";

const TIER_LIST = [
  { code: "god", tier: "01", label: "최고", tag: "DIVINE", color: "GOLD", min: "3000+" },
  { code: "genius", tier: "02", label: "천재", tag: "GENIUS", color: "VIOLET", min: "2200" },
  { code: "sharp", tier: "03", label: "예리", tag: "SHARP", color: "BLUE", min: "1500" },
  { code: "rookie", tier: "04", label: "새내기", tag: "FRESH", color: "LIME", min: "1000" },
  { code: "dull", tier: "05", label: "무딘", tag: "DORMANT", color: "STONE", min: "0" },
  { code: "cursed", tier: "06", label: "고장", tag: "GLITCH", color: "CRIMSON", min: "별도" },
] as const;

const TIER_LONG_DESC: Record<string, string> = {
  god: "모든 미래를 꿰뚫어 보는 신비롭고 찬란한 황금빛 예지력.",
  genius: "남다른 예지력을 가진 천재의 번뜩이는 보라색 이성.",
  sharp: "날카로운 예감이 정확하게 적중하는 차갑고 날카로운 푸른빛.",
  rookie: "촉의 씨앗이 싹트기 시작하는 부드럽고 싱그러운 에너지.",
  dull: "아직 깨어나지 않은 차분한 회색 원석. 잠재력은 묻혀 있습니다.",
  cursed: "에너지가 삐딱하게 어긋난 빨간색 구체. 이상한 방향으로만 적중!",
};

const TIER_GRADE: Record<string, string> = {
  god: "최고 등급", genius: "초고급", sharp: "고급",
  rookie: "초급", dull: "하급", cursed: "최하 등급",
};

export default function StatsPage() {
  const { token, user, loading: authLoading, logout, refresh } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<VoteHistoryItem[]>([]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login");
    }
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    refresh();
    api.get<{ items: VoteHistoryItem[] }>("/me/history?limit=20", token).then((d) => setHistory(d.items)).catch(() => {});
  }, [token, refresh]);

  if (authLoading || !user) {
    return <div className="flex min-h-dvh items-center justify-center text-jd-muted">로딩 중...</div>;
  }

  const effectiveLevel = user.is_cursed ? "cursed" : user.level_code;
  const levelLabel = LEVEL_LABELS[effectiveLevel] ?? user.level_code;
  const levelColor = LEVEL_COLORS[effectiveLevel] ?? "text-slate-400";
  const levelBg = LEVEL_BG_COLORS[effectiveLevel] ?? "from-slate-100 to-slate-50";
  const levelRing = LEVEL_RING_COLORS[effectiveLevel] ?? "ring-slate-300";
  const levelDesc = LEVEL_DESC[effectiveLevel] ?? "";

  return (
    <div>
      <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <h1 className="text-lg font-bold">내 촉</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-jd-muted transition hover:bg-white/[0.06] hover:text-white"
          >
            <Settings size={14} />
            정보수정
          </Link>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-jd-muted transition hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </header>

      {/* 프로필 히어로 — SVG 오브 적용 */}
      <section className="tier-hero px-4 pb-6 pt-8 text-center">
        <div className="mx-auto mb-2 flex h-28 w-28 items-center justify-center">
          <TierOrb code={effectiveLevel} className="!w-24 !h-24" />
        </div>
        <p className={cn("mb-1 text-xl font-extrabold", levelColor)}>{levelLabel}</p>
        <p className="mb-1 text-xs text-tier-dim">{levelDesc}</p>
        <h2 className="text-base font-semibold text-white">{user.nickname ?? "닉네임 미설정"}</h2>
      </section>

      {/* PQ 점수 */}
      <section className="mx-4 -mt-4 mb-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center shadow-md backdrop-blur">
        <p className="mb-2 text-lg font-bold tracking-wide text-white">예지력 점수</p>
        <p className="text-3xl font-bold tracking-tight text-amber-400">{user.pq_score.toLocaleString()}</p>
        <p className="mt-1 text-[11px] text-tier-dim">PQ (Prophetic Quotient)</p>
      </section>

      {/* 스탯 그리드 */}
      <section className="mx-4 mb-6 grid grid-cols-2 gap-3">
        <StatBox icon={<Target size={18} />} label="총 예측" value={`${user.total_predictions}회`} />
        <StatBox icon={<TrendingUp size={18} />} label="적중률" value={pct(user.win_rate)} />
        <StatBox icon={<Flame size={18} />} label="적중" value={`${user.total_wins}회`} />
        <StatBox icon={<Zap size={18} />} label="연속 적중" value={`${user.current_streak}연속`} />
      </section>

      {/* 투표 이력 */}
      <section className="px-4">
        <h3 className="mb-3 text-sm font-semibold text-tier-dim">최근 예측</h3>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-tier-dim">아직 예측 기록이 없습니다</p>
        ) : (
          <div className="space-y-2 pb-4">
            {history.map((h) => (
              <div key={h.card_id + h.voted_at} className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 text-left">
                <p className="mb-1 text-sm leading-snug text-white/90">{h.card_title}</p>
                <div className="flex items-center gap-2 text-xs text-tier-dim">
                  <span className={h.choice === "YES" ? "text-green-400" : "text-red-400"}>내 선택: {h.choice}</span>
                  {h.settled && h.delta !== null && (
                    <span className={cn("ml-auto font-semibold", h.delta > 0 ? "text-green-400" : h.delta < 0 ? "text-red-400" : "text-tier-dim")}>
                      {h.delta > 0 ? "+" : ""}
                      {h.delta}
                    </span>
                  )}
                  {!h.settled && <span className="ml-auto">결과 대기</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 촉 점수 규칙 */}
      <section className="mx-4 mb-4 mt-2">
        <h3 className="mb-3 text-sm font-semibold text-tier-dim">촉 점수(PQ) 계산 규칙</h3>
        <div className="space-y-3">
          <RuleCard icon="🎯" title="적중" desc="예측이 맞으면 +50점" accent="text-green-400" />
          <RuleCard icon="❌" title="실패" desc="예측이 틀리면 -30점" accent="text-red-400" />
          <RuleCard icon="🔥" title="역배 보너스" desc="소수파 선택을 맞추면 최대 2배(+100점)! 확률이 낮을수록 보너스 UP" accent="text-amber-400" />
          <RuleCard icon="🚫" title="무효(VOID)" desc="사건이 무산되면 점수 변동 없이 원상복구" accent="text-slate-400" />
          <RuleCard icon="🛡️" title="최저 점수 보호" desc="PQ는 0점 아래로 내려가지 않아요" accent="text-blue-400" />
        </div>
      </section>

      {/* 촉 등급 컬렉션 */}
      <section className="mx-4 mb-8">
        <div className="mb-4">
          <span className="tier-eyebrow mb-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-purple-300">
            촉 컬렉션 · CHOK TIERS
          </span>
          <h3 className="text-base font-bold text-white">촉 등급 시스템</h3>
        </div>

        <div className="space-y-3">
          {TIER_LIST.map((t) => {
            const isCurrent = effectiveLevel === t.code;
            return (
              <div
                key={t.code}
                className={cn(
                  "tier-card relative isolate overflow-hidden rounded-2xl border border-white/[0.08] p-4 transition",
                  `tier-${t.code}`,
                  isCurrent && "tier-current"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* 오브 */}
                  <div className="flex-shrink-0">
                    <TierOrb code={t.code} className="!w-16 !h-16" />
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-tier-dim">
                        TIER {t.tier}
                      </span>
                      {isCurrent && (
                        <span className="tier-badge-current rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider">
                          NOW
                        </span>
                      )}
                    </div>
                    <p className={cn("tier-ko-name text-base font-bold leading-tight")}>
                      {LEVEL_LABELS[t.code]}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-tier-dim line-clamp-2">
                      {TIER_LONG_DESC[t.code]}
                    </p>
                  </div>

                  {/* PQ 기준 */}
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[10px] text-tier-dim">
                      {t.code === "cursed" ? "승률" : "PQ"}
                    </span>
                    <p className="text-sm font-bold text-white/80">
                      {t.code === "cursed" ? "30%↓" : t.min}
                    </p>
                  </div>
                </div>

                {/* 태그 */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="tier-tag">{t.tag}</span>
                  <span className="tier-tag">{t.color}</span>
                  <span className="tier-tag">{TIER_GRADE[t.code]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RuleCard({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className={cn("text-sm font-semibold", accent)}>{title}</p>
        <p className="text-xs leading-relaxed text-tier-dim">{desc}</p>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-tier-dim">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-lg font-bold text-white text-center">{value}</p>
    </div>
  );
}
