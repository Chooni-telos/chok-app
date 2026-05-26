"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TierOrb } from "@/components/tier-orb";
import { cn } from "@/lib/utils";

type Phase = "idle" | "picking" | "revealing" | "done";
type SymbolKey = "circle" | "plus" | "waves" | "square" | "star";

const SYMBOLS: SymbolKey[] = ["circle", "plus", "waves", "square", "star"];
const TOTAL = 25;

const SYM_COLOR: Record<SymbolKey, string> = {
  circle: "#fbbf24",
  plus: "#4ade80",
  waves: "#60a5fa",
  square: "#f87171",
  star: "#c8a6ff",
};

const SYM_LABEL: Record<SymbolKey, string> = {
  circle: "원",
  plus: "십자",
  waves: "물결",
  square: "사각",
  star: "별",
};

function randomSym(): SymbolKey {
  return SYMBOLS[Math.floor(Math.random() * 5)];
}

function verdict(hits: number) {
  if (hits >= 12) return { tier: "god", text: "미래가 보이시나요?!", label: "신들린 촉" };
  if (hits >= 9) return { tier: "genius", text: "놀라운 예지력의 소유자!", label: "촉 천재" };
  if (hits >= 7) return { tier: "sharp", text: "예리한 감각이 느껴집니다", label: "예리한 촉" };
  if (hits >= 4) return { tier: "rookie", text: "촉의 씨앗이 싹트고 있어요", label: "촉 새내기" };
  return { tier: "dull", text: "촉이 아직 깨어나지 않았어요", label: "무딘 촉" };
}

interface TestResult {
  date: string;
  hits: number;
  rate: number;
}

function storageKey(userId: string | undefined) {
  return `chok-zener-${userId ?? "guest"}`;
}

function loadHistory(userId: string | undefined): TestResult[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) || "[]"); }
  catch { return []; }
}

function saveResult(r: TestResult, userId: string | undefined) {
  const h = loadHistory(userId);
  h.unshift(r);
  localStorage.setItem(storageKey(userId), JSON.stringify(h.slice(0, 20)));
}

export default function ZenerPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [answer, setAnswer] = useState<SymbolKey>("circle");
  const [picked, setPicked] = useState<SymbolKey | null>(null);
  const [isHit, setIsHit] = useState(false);
  const [history, setHistory] = useState<TestResult[]>([]);

  useEffect(() => { setHistory(loadHistory(uid)); }, [uid]);

  function start() {
    setPhase("picking");
    setRound(1);
    setHits(0);
    setPicked(null);
    setAnswer(randomSym());
  }

  function pick(sym: SymbolKey) {
    if (phase !== "picking") return;
    const hit = sym === answer;
    setPicked(sym);
    setIsHit(hit);
    const newHits = hit ? hits + 1 : hits;
    if (hit) setHits(newHits);
    setPhase("revealing");

    setTimeout(() => {
      if (round >= TOTAL) {
        saveResult({ date: new Date().toISOString(), hits: newHits, rate: newHits / TOTAL }, uid);
        setHistory(loadHistory(uid));
        setPhase("done");
      } else {
        setRound((r) => r + 1);
        setAnswer(randomSym());
        setPicked(null);
        setPhase("picking");
      }
    }, 1200);
  }

  const v = verdict(hits);

  /* ─── IDLE ─── */
  if (phase === "idle") {
    return (
      <div className="px-4 pb-20 pt-6">
        <header className="mb-6 text-center">
          <span className="tier-eyebrow mb-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-purple-300">
            ESP · ZENER CARDS
          </span>
          <h1 className="tier-title mb-2 text-3xl font-black leading-tight">
            예지력 측정
          </h1>
          <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-jd-muted">
            1930년대 초심리학자 칼 제너와 J.B. 라인 박사가 개발한
            역사적인 예지력 실험입니다.
          </p>
        </header>

        {/* 설명 카드 */}
        <div className="mx-auto mb-6 max-w-[320px] rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-xs leading-relaxed text-jd-muted">
          <p>
            5가지 심볼(○ ＋ 〰 □ ☆) 카드 <span className="text-white/85">25장</span>을
            사용해 다음 카드의 문양을 맞히는 방식으로 진행됩니다.
          </p>
          <p className="mt-2">
            확률상 평균은 <span className="text-white/85">5장(20%)</span>.
            이를 유의미하게 넘어서면 당신의 촉은 진짜일지도?
          </p>
        </div>

        {/* 심볼 미리보기 */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {SYMBOLS.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <ZenerSymbol sym={s} size={28} />
              </div>
              <span className="text-[10px] text-jd-muted">{SYM_LABEL[s]}</span>
            </div>
          ))}
        </div>

        <button
          onClick={start}
          className="mx-auto block w-full max-w-[260px] rounded-xl bg-jd-accent py-3.5 text-sm font-bold text-white transition hover:bg-jd-accent/80 active:scale-95"
        >
          측정 시작
        </button>

        {/* 히스토리 */}
        {history.length > 0 && (
          <section className="mt-10">
            <h3 className="mb-3 text-xs font-semibold text-jd-muted">최근 측정 기록</h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                  <span className="text-xs text-jd-muted">
                    {new Date(h.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white/90">{h.hits}/{TOTAL}</span>
                    <span className={cn("text-xs font-semibold", h.rate > 0.2 ? "text-jd-yes" : h.rate < 0.2 ? "text-jd-no" : "text-jd-muted")}>
                      {(h.rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ─── PLAYING / REVEALING ─── */
  if (phase === "picking" || phase === "revealing") {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-4 pb-20 pt-6">
        {/* 상단 정보 */}
        <div className="mb-2 flex items-center justify-between text-xs text-jd-muted">
          <span>라운드 {round}/{TOTAL}</span>
          <span className="font-semibold text-jd-yes">{hits} 적중</span>
        </div>

        {/* 프로그레스 바 */}
        <div className="mb-8 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-jd-accent transition-all duration-300"
            style={{ width: `${(round / TOTAL) * 100}%` }}
          />
        </div>

        {/* 카드 영역 */}
        <div className="flex flex-1 items-center justify-center">
          <div className="zener-card-flip" style={{ width: 180, height: 240 }}>
            <div className={cn("zener-card-inner", phase === "revealing" && "flipped")}>
              {/* 카드 뒷면 */}
              <div className="zener-card-face zener-card-back">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 border-jd-accent/40 bg-gradient-to-b from-jd-accent/20 to-purple-900/30">
                  <span className="text-4xl font-black text-jd-accent/60">?</span>
                  <span className="mt-1 text-[10px] tracking-widest text-jd-accent/40">CHOK</span>
                </div>
              </div>
              {/* 카드 앞면 */}
              <div className="zener-card-face zener-card-front">
                <div className={cn(
                  "flex h-full w-full flex-col items-center justify-center rounded-2xl border-2",
                  isHit ? "border-jd-yes/50 bg-jd-yes/10" : "border-jd-no/50 bg-jd-no/10"
                )}>
                  <ZenerSymbol sym={answer} size={72} />
                  <span className="mt-3 text-xs font-bold text-jd-muted">{SYM_LABEL[answer]}</span>
                  <span className={cn("mt-2 text-sm font-bold", isHit ? "text-jd-yes" : "text-jd-no")}>
                    {isHit ? "적중!" : "빗나감"}
                  </span>
                  {picked && !isHit && (
                    <span className="mt-0.5 text-[10px] text-jd-muted">선택: {SYM_LABEL[picked]}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 심볼 선택 버튼 */}
        <div className="mt-8 mb-4">
          <p className="mb-3 text-center text-xs text-jd-muted">
            {phase === "picking" ? "어떤 심볼이 숨어 있을까요?" : "다음 라운드 준비 중..."}
          </p>
          <div className="flex justify-center gap-3">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                disabled={phase !== "picking"}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl border transition active:scale-90",
                  phase !== "picking"
                    ? "border-white/[0.04] opacity-40"
                    : "border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/[0.2]",
                  picked === s && phase === "revealing" && (isHit ? "ring-2 ring-jd-yes" : "ring-2 ring-jd-no")
                )}
              >
                <ZenerSymbol sym={s} size={28} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── DONE ─── */
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4 pb-20 pt-6 text-center">
      {/* 오브 */}
      <div className="mb-4">
        <TierOrb code={v.tier} className="!w-28 !h-28" />
      </div>

      <p className="mb-1 text-sm font-semibold text-jd-accent">{v.label}</p>
      <p className="mb-6 text-xs text-jd-muted">{v.text}</p>

      {/* 결과 숫자 */}
      <div className="mb-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-8 py-5">
        <p className="text-4xl font-black text-white">
          {hits}<span className="text-lg text-jd-muted">/{TOTAL}</span>
        </p>
        <p className="mt-1 text-sm text-jd-muted">적중</p>
      </div>

      <div className="mb-8 flex items-center gap-4 text-xs">
        <div>
          <span className="text-jd-muted">내 적중률 </span>
          <span className={cn("font-bold", hits / TOTAL > 0.2 ? "text-jd-yes" : hits / TOTAL < 0.2 ? "text-jd-no" : "text-white/85")}>
            {((hits / TOTAL) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-3 w-px bg-white/[0.1]" />
        <div>
          <span className="text-jd-muted">기대값 </span>
          <span className="font-bold text-white/70">20%</span>
        </div>
      </div>

      <button
        onClick={start}
        className="flex items-center gap-2 rounded-xl bg-jd-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-jd-accent/80 active:scale-95"
      >
        <RotateCcw size={16} />
        다시 측정하기
      </button>
      <button
        onClick={() => { setPhase("idle"); }}
        className="mt-3 text-xs text-jd-muted hover:text-white/60 transition"
      >
        처음으로 돌아가기
      </button>
    </div>
  );
}

/* ─── Zener Symbol SVG ─── */
function ZenerSymbol({ sym, size = 40 }: { sym: SymbolKey; size?: number }) {
  const c = SYM_COLOR[sym];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {sym === "circle" && (
        <circle cx="50" cy="50" r="32" stroke={c} strokeWidth="5" fill={c} fillOpacity=".15" />
      )}
      {sym === "plus" && (
        <>
          <rect x="18" y="40" width="64" height="20" rx="4" fill={c} fillOpacity=".9" />
          <rect x="40" y="18" width="20" height="64" rx="4" fill={c} fillOpacity=".9" />
        </>
      )}
      {sym === "waves" && (
        <g stroke={c} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M15,35 Q32.5,18 50,35 Q67.5,52 85,35" />
          <path d="M15,55 Q32.5,38 50,55 Q67.5,72 85,55" />
          <path d="M15,75 Q32.5,58 50,75 Q67.5,92 85,75" />
        </g>
      )}
      {sym === "square" && (
        <rect x="20" y="20" width="60" height="60" rx="6" stroke={c} strokeWidth="5" fill={c} fillOpacity=".15" />
      )}
      {sym === "star" && (
        <polygon
          points="50,10 61,38 92,38 67,56 76,85 50,68 24,85 33,56 8,38 39,38"
          fill={c}
          fillOpacity=".9"
        />
      )}
    </svg>
  );
}
