"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { LEVEL_LABELS, LEVEL_COLORS } from "@/lib/constants";
import { cn, pct } from "@/lib/utils";
import { TierOrb } from "@/components/tier-orb";
import type { LeaderboardEntry } from "@/lib/types";

interface MyRank {
  rank: number;
  pq_score: number;
  level_code: string;
  nickname: string | null;
  win_rate: number;
  total_votes: number;
}

const SAMPLE_DATA: LeaderboardEntry[] = [
  { rank: 1, user_id: "s1", nickname: "노스트라다무스", pq_score: 4820, level_code: "god", win_rate: 0.82 },
  { rank: 2, user_id: "s2", nickname: "촉의신", pq_score: 3950, level_code: "god", win_rate: 0.76 },
  { rank: 3, user_id: "s3", nickname: "예언자김씨", pq_score: 3410, level_code: "god", win_rate: 0.71 },
  { rank: 4, user_id: "s4", nickname: "미래소녀", pq_score: 2890, level_code: "genius", win_rate: 0.68 },
  { rank: 5, user_id: "s5", nickname: "직감대마왕", pq_score: 2650, level_code: "genius", win_rate: 0.65 },
  { rank: 6, user_id: "s6", nickname: "촉촉한감각", pq_score: 2340, level_code: "genius", win_rate: 0.62 },
  { rank: 7, user_id: "s7", nickname: "예리한눈", pq_score: 1980, level_code: "sharp", win_rate: 0.58 },
  { rank: 8, user_id: "s8", nickname: "감이좋아", pq_score: 1750, level_code: "sharp", win_rate: 0.55 },
  { rank: 9, user_id: "s9", nickname: "촉새내기", pq_score: 1520, level_code: "sharp", win_rate: 0.53 },
  { rank: 10, user_id: "s10", nickname: "럭키세븐", pq_score: 1380, level_code: "rookie", win_rate: 0.50 },
];


export default function RankingPage() {
  const { token, user: authUser } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ items: LeaderboardEntry[]; my_rank: MyRank | null; total_users: number }>(
        "/leaderboard?limit=50",
        token,
      )
      .then((d) => {
        const real = d.items || [];
        const minScore = real.length > 0 ? real[real.length - 1].pq_score : 0;
        const nextRank = real.length > 0 ? real[real.length - 1].rank + 1 : 1;
        const filler = SAMPLE_DATA.filter((s) => s.pq_score < minScore).map((s, i) => ({
          ...s,
          rank: nextRank + i,
        }));
        setEntries([...real, ...filler]);
        setMyRank(d.my_rank);
        setTotalUsers(d.total_users || Math.max(real.length, 1));
      })
      .catch(() => {
        setEntries(SAMPLE_DATA);
        setMyRank({ rank: 8, pq_score: 1750, level_code: "sharp", nickname: "나", win_rate: 0.55, total_votes: 20 });
        setTotalUsers(15);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const top10 = entries.slice(0, 10);
  const MEDAL = ["🥇", "🥈", "🥉"];

  const effectiveLevel = myRank
    ? authUser?.is_cursed
      ? "cursed"
      : myRank.level_code
    : "rookie";

  const tierCounts: Record<string, number> = {};
  for (const e of entries) {
    tierCounts[e.level_code] = (tierCounts[e.level_code] || 0) + 1;
  }

  const myPercentile = myRank && totalUsers > 0 ? Math.round(((totalUsers - myRank.rank) / totalUsers) * 100) : null;

  return (
    <div className="pb-20">
      <header className="border-b border-white/[0.08] px-4 py-3">
        <h1 className="text-lg font-bold">랭킹</h1>
      </header>

      {loading ? (
        <div className="space-y-3 px-4 py-4">
          <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          {/* ── 3. 내 순위 히어로 카드 ── */}
          {myRank && (
            <section className="px-4 pt-4">
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-jd-accent/20 via-white/[0.06] to-transparent p-5">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <TierOrb code={effectiveLevel} className="!w-16 !h-16" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-jd-muted">내 현재 순위</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-white">{myRank.rank}</span>
                      <span className="text-lg font-bold text-white/60">위</span>
                      {totalUsers > 0 && (
                        <span className="text-xs text-jd-muted">/ {totalUsers}명</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-white/80">
                      {myRank.nickname ?? "닉네임 미설정"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-2xl font-bold text-jd-pq">{myRank.pq_score.toLocaleString()}</p>
                    <p className="text-[10px] text-jd-muted">PQ</p>
                    <p className={cn("mt-1 text-xs font-semibold", LEVEL_COLORS[effectiveLevel])}>
                      {LEVEL_LABELS[effectiveLevel]}
                    </p>
                  </div>
                </div>
                {myPercentile !== null && (
                  <p className="mt-3 text-center text-sm text-jd-muted">
                    상위 <span className="text-lg font-bold text-jd-accent">{Math.max(1, 100 - myPercentile)}%</span>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── 2. 전체 분포 그래프 + 내 위치 ── */}
          <section className="px-4 pt-4">
            <h3 className="mb-3 text-sm font-bold text-white">등급 분포</h3>
            <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.08] via-jd-accent/[0.06] to-white/[0.02] p-4">
              <DistributionGraph
                entries={entries}
                myRank={myRank}
                totalUsers={totalUsers}
                effectiveLevel={effectiveLevel}
              />
            </div>
          </section>

          {/* ── 1+4. TOP 10 리스트 (등급 아이콘 포함) ── */}
          <section className="px-4 pt-4">
            <h3 className="mb-3 text-sm font-bold text-white">TOP 10</h3>
            {top10.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-jd-muted">
                <Trophy size={48} className="mb-3 opacity-30" />
                <p>아직 랭킹 데이터가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {top10.map((e) => {
                  const isMe = authUser && e.user_id === authUser.id;
                  return (
                    <div
                      key={e.user_id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                        isMe
                          ? "border-jd-accent/40 bg-jd-accent/10"
                          : "border-white/[0.06] bg-white/[0.04]",
                      )}
                    >
                      {/* 순위 */}
                      <div className="w-7 text-center text-sm font-bold">
                        {e.rank <= 3 ? MEDAL[e.rank - 1] : <span className="text-jd-muted">{e.rank}</span>}
                      </div>

                      {/* 등급 아이콘 */}
                      <div className="flex-shrink-0">
                        <TierOrb code={e.level_code} className="!w-9 !h-9" />
                      </div>

                      {/* 유저 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("truncate text-sm font-semibold", isMe ? "text-jd-accent" : "text-white")}>
                          {e.nickname ?? "익명"}
                          {isMe && <span className="ml-1 text-[10px] text-jd-accent/70">나</span>}
                        </p>
                        <p className={cn("text-xs", LEVEL_COLORS[e.level_code] ?? "text-jd-muted")}>
                          {LEVEL_LABELS[e.level_code] ?? e.level_code}
                        </p>
                      </div>

                      {/* PQ + 적중률 */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-jd-pq">{e.pq_score.toLocaleString()}</p>
                        <p className="text-xs text-jd-muted">{pct(e.win_rate)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DistributionGraph({
  entries,
  myRank,
}: {
  entries: LeaderboardEntry[];
  myRank: MyRank | null;
  totalUsers: number;
  effectiveLevel: string;
}) {
  const scores = entries.map((e) => e.pq_score);
  if (myRank) scores.push(myRank.pq_score);
  const maxScore = Math.max(...scores, 3000);
  const graphMax = Math.ceil(maxScore / 500) * 500;

  const W = 360;
  const H = 200;
  const PAD_L = 34;
  const PAD_R = 8;
  const PAD_T = 24;
  const PAD_B = 32;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const BIN_COUNT = 12;
  const binWidth = graphMax / BIN_COUNT;
  const bins = new Array(BIN_COUNT).fill(0);
  for (const s of entries.map((e) => e.pq_score)) {
    const idx = Math.min(Math.floor(s / binWidth), BIN_COUNT - 1);
    bins[idx]++;
  }
  const maxBin = Math.max(...bins, 1);

  const baseline = PAD_T + plotH;
  const barGap = 2;
  const barW = (plotW - barGap * (BIN_COUNT - 1)) / BIN_COUNT;

  const myBinIdx = myRank ? Math.min(Math.floor(myRank.pq_score / binWidth), BIN_COUNT - 1) : -1;

  const xTicks = [0, 500, 1000, 1500, 2000, 2500, 3000].filter((s) => s <= graphMax);
  const yTickCount = Math.min(maxBin, 4);
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(Math.round((maxBin / yTickCount) * i));
  }

  function toX(score: number) {
    return PAD_L + (score / graphMax) * plotW;
  }
  function toY(count: number) {
    return PAD_T + plotH - (count / maxBin) * plotH;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9b78ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9b78ff" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="bar-my" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8a6ff" />
          <stop offset="100%" stopColor="#9b78ff" />
        </linearGradient>
      </defs>

      {/* 단색 배경 */}
      <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} rx="4" fill="rgba(255,255,255,0.03)" />

      {/* y축 그리드 + 라벨 (명) */}
      {yTicks.map((v) => {
        const y = toY(v);
        return (
          <g key={`y-${v}`}>
            {v > 0 && (
              <line x1={PAD_L} y1={y} x2={PAD_L + plotW} y2={y} stroke="#e8e6f0" strokeOpacity="0.06" strokeWidth="0.5" />
            )}
            <text x={PAD_L - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#e8e6f0" opacity="0.5">
              {v}
            </text>
          </g>
        );
      })}
      <text x={4} y={PAD_T - 7} fontSize="10" fill="#e8e6f0" opacity="0.4">명</text>

      {/* x축 점수 눈금 */}
      {xTicks.map((s) => {
        const x = toX(s);
        return (
          <g key={`x-${s}`}>
            <line x1={x} y1={baseline} x2={x} y2={baseline + 4} stroke="#e8e6f0" strokeOpacity="0.15" strokeWidth="0.5" />
            <text x={x} y={baseline + 16} textAnchor="middle" fontSize="10" fill="#e8e6f0" opacity="0.5">
              {s >= 1000 ? `${s / 1000}k` : s}
            </text>
          </g>
        );
      })}

      {/* 막대 */}
      {bins.map((count, i) => {
        if (count === 0) return null;
        const x = PAD_L + i * (barW + barGap);
        const h = (count / maxBin) * plotH;
        const y = baseline - h;
        const isMyBin = i === myBinIdx;
        return (
          <g key={`bar-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="2"
              fill={isMyBin ? "url(#bar-my)" : "url(#bar-grad)"}
              opacity={isMyBin ? 1 : 0.7}
            />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#e8e6f0" opacity="0.6">
              {count}
            </text>
          </g>
        );
      })}

      {/* 내 위치 마커 */}
      {myRank && myBinIdx >= 0 && (
        <g>
          {(() => {
            const mx = PAD_L + myBinIdx * (barW + barGap) + barW / 2;
            const mh = (bins[myBinIdx] / maxBin) * plotH;
            const my = baseline - mh - 22;
            return (
              <>
                <rect x={mx - 24} y={my} width="48" height="16" rx="4" fill="#9b78ff" />
                <text x={mx} y={my + 12} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">
                  나 {myRank.pq_score}
                </text>
                <line x1={mx} y1={my + 14} x2={mx} y2={baseline - mh} stroke="#9b78ff" strokeWidth="1" opacity="0.5" />
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
