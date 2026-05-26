"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogIn, Users, Trophy, Zap, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  member_count: number;
  role: string;
}

export default function GroupsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<GroupItem[]>("/groups", token);
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login");
      return;
    }
    loadGroups();
  }, [authLoading, token, router, loadGroups]);

  async function handleCreate() {
    if (!name.trim()) { setError("방 이름을 입력해주세요."); return; }
    setSubmitting(true);
    setError("");
    try {
      const g = await api.post<GroupItem>("/groups", { name: name.trim() }, token);
      setShowCreate(false);
      setName("");
      router.push(`/groups/${g.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "생성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin() {
    if (!code.trim()) { setError("초대 코드를 입력해주세요."); return; }
    setSubmitting(true);
    setError("");
    try {
      const g = await api.post<GroupItem>("/groups/join", { invite_code: code.trim() }, token);
      setShowJoin(false);
      setCode("");
      router.push(`/groups/${g.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "참여에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasGroups = groups.length > 0;

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0b0a18]/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">Chok &amp; Talk</h1>
      </header>

      {/* 소개 섹션 */}
      {!hasGroups && !loading && (
        <section className="px-4 pt-6 pb-2">
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-jd-accent/15 via-white/[0.04] to-transparent p-5 text-center">
            <div className="mb-3 text-4xl">🔮</div>
            <h2 className="mb-2 text-lg font-bold text-white">친구들과 예지력 대결!</h2>
            <p className="mb-4 text-sm leading-relaxed text-jd-muted">
              촉앤톡을 만들어 친구, 반 친구, 동료와 함께<br />
              나만의 예측 문제를 출제하고 맞춰보세요.
            </p>
            <div className="mx-auto max-w-[280px] space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-jd-accent/20 text-jd-accent">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">방 만들기 & 초대</p>
                  <p className="text-xs text-jd-muted">초대 코드 한 번으로 친구 참여</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-jd-accent/20 text-jd-accent">
                  <MessageCircle size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">직접 문제 출제</p>
                  <p className="text-xs text-jd-muted">O/X, 객관식 등 자유롭게 예측 만들기</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-jd-accent/20 text-jd-accent">
                  <Trophy size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">그룹 랭킹</p>
                  <p className="text-xs text-jd-muted">누가 촉이 가장 좋은지 겨루기</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-jd-accent/20 text-jd-accent">
                  <Zap size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">출제자가 정답 입력</p>
                  <p className="text-xs text-jd-muted">결과 나오면 바로 정산 & 점수 반영</p>
                </div>
              </div>
            </div>

            {/* 샘플 + 초대 */}
            <div className="mx-auto mt-4 flex max-w-[300px] gap-3 text-left">
              <div className="flex-1">
                <p className="mb-1.5 text-[10px] font-semibold text-white/50">예측 예시</p>
                <div className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-jd-muted">🍚 오늘 급식에 생선 나온다</div>
                <div className="mt-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-jd-muted">⚽ 체육시간 축구 vs 농구</div>
              </div>
              <div className="flex-1">
                <p className="mb-1.5 text-[10px] font-semibold text-white/50">친구 초대</p>
                <p className="text-xs leading-relaxed text-jd-muted">방 만들기 → 초대 코드 복사 → 카톡으로 공유하면 끝!</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 px-4 pt-4">
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-jd-accent py-3 text-sm font-semibold text-white transition hover:bg-jd-accent/80"
        >
          <Plus size={16} /> 방 만들기
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.1] py-3 text-sm font-semibold text-jd-muted transition hover:bg-white/[0.04]"
        >
          <LogIn size={16} /> 코드로 참여
        </button>
      </div>

      {/* 방 만들기 모달 */}
      {showCreate && (
        <div className="mx-4 mt-3 rounded-xl border border-white/[0.1] bg-white/[0.04] p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="방 이름 (예: 3반 예측왕)"
            maxLength={50}
            className="mb-3 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-jd-accent"
          />
          {error && <p className="mb-2 text-center text-xs text-jd-no">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-white/[0.1] py-2.5 text-sm text-jd-muted">취소</button>
            <button onClick={handleCreate} disabled={submitting} className="flex-1 rounded-lg bg-jd-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? "생성 중..." : "만들기"}
            </button>
          </div>
        </div>
      )}

      {/* 코드로 참여 모달 */}
      {showJoin && (
        <div className="mx-4 mt-3 rounded-xl border border-white/[0.1] bg-white/[0.04] p-4">
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
            placeholder="초대 코드 입력"
            maxLength={20}
            className="mb-3 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-center text-sm font-mono tracking-widest text-white placeholder:text-white/40 outline-none focus:border-jd-accent"
          />
          {error && <p className="mb-2 text-center text-xs text-jd-no">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowJoin(false)} className="flex-1 rounded-lg border border-white/[0.1] py-2.5 text-sm text-jd-muted">취소</button>
            <button onClick={handleJoin} disabled={submitting} className="flex-1 rounded-lg bg-jd-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? "참여 중..." : "참여하기"}
            </button>
          </div>
        </div>
      )}

      {/* 내 방 목록 */}
      {loading ? (
        <div className="space-y-3 px-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : hasGroups && (
        <div className="space-y-4 px-4 pt-4">
          {groups.filter((g) => g.role === "owner").length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-white">👑 내가 만든 방</h3>
              <div className="space-y-2">
                {groups.filter((g) => g.role === "owner").map((g) => (
                  <button
                    key={g.id}
                    onClick={() => router.push(`/groups/${g.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-jd-accent/30 bg-jd-accent/[0.08] px-4 py-3 text-left transition hover:bg-jd-accent/15"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jd-accent/25 text-lg">
                      👑
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{g.name}</p>
                      <p className="text-xs text-jd-accent/70">{g.member_count}명 참여 · 방장</p>
                    </div>
                    <span className="text-xs text-jd-accent/40">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.filter((g) => g.role !== "owner").length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-white">🔮 참여 중인 방</h3>
              <div className="space-y-2">
                {groups.filter((g) => g.role !== "owner").map((g) => (
                  <button
                    key={g.id}
                    onClick={() => router.push(`/groups/${g.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-lg">
                      🔮
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{g.name}</p>
                      <p className="text-xs text-jd-muted">{g.member_count}명 참여</p>
                    </div>
                    <span className="text-xs text-white/30">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
