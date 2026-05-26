"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대 이상"] as const;
const GENDERS = ["남성", "여성"] as const;
const INTEREST_TOPICS = ["시사", "스포츠", "엔터테인먼트", "경제테크", "도파민"] as const;

export default function SettingsPage() {
  const { token, user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    nickname: "",
    email: "",
    age_group: "",
    gender: "",
    interests: [] as string[],
  });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) router.push("/login");
  }, [authLoading, token, router]);

  useEffect(() => {
    if (user) {
      setForm({
        nickname: user.nickname ?? "",
        email: user.email ?? "",
        age_group: user.age_group ?? "",
        interests: user.interests ?? [],
        gender: user.gender ?? "",
      });
    }
  }, [user]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMsg("");
  }

  async function handleSave() {
    setMsg("");
    if (form.nickname.length < 2) {
      setMsg("닉네임은 2자 이상이어야 합니다.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/me", form, token);
      await refresh();
      setMsg("저장되었습니다.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwMsg("");
    setPwOk(false);
    if (pw.next.length < 6) {
      setPwMsg("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/me/change-password", {
        current_password: pw.current,
        new_password: pw.next,
      }, token);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg("비밀번호가 변경되었습니다.");
      setPwOk(true);
    } catch (e) {
      setPwMsg(e instanceof ApiError ? e.message : "변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return <div className="flex min-h-dvh items-center justify-center text-jd-muted">로딩 중...</div>;
  }

  const inputClass =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-jd-accent focus:ring-1 focus:ring-jd-accent";

  const isLocal = user.preferred_language !== undefined;

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/[0.08] bg-[#0b0a18]/95 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-jd-muted hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">내 정보 수정</h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 pt-6">
        {/* 프로필 정보 */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-white">프로필</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">닉네임</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => update("nickname", e.target.value)}
              placeholder="2~20자"
              maxLength={20}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="example@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">연령대</label>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map((ag) => (
                <button
                  key={ag}
                  type="button"
                  onClick={() => update("age_group", ag)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    form.age_group === ag
                      ? "bg-jd-accent text-white"
                      : "bg-white/[0.06] text-jd-muted hover:bg-white/[0.1]",
                  )}
                >
                  {ag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">성별</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => update("gender", g)}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-sm font-medium transition",
                    form.gender === g
                      ? "bg-jd-accent text-white"
                      : "bg-white/[0.06] text-jd-muted hover:bg-white/[0.1]",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">관심주제 (복수선택)</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_TOPICS.map((topic) => {
                const selected = form.interests.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        interests: selected
                          ? prev.interests.filter((t) => t !== topic)
                          : [...prev.interests, topic],
                      }));
                      setMsg("");
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      selected
                        ? "bg-jd-accent text-white"
                        : "bg-white/[0.06] text-jd-muted hover:bg-white/[0.1]",
                    )}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {msg && (
            <p className={cn("text-center text-xs", msg === "저장되었습니다." ? "text-jd-yes" : "text-jd-no")}>
              {msg}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-jd-accent py-3 text-sm font-semibold text-white transition hover:bg-jd-accent/80 disabled:opacity-50"
          >
            <Check size={16} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </section>

        {/* 비밀번호 변경 */}
        <section className="space-y-4 border-t border-white/[0.08] pt-6">
          <h2 className="text-sm font-bold text-white">비밀번호 변경</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">현재 비밀번호</label>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => { setPw((p) => ({ ...p, current: e.target.value })); setPwMsg(""); }}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">새 비밀번호</label>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => { setPw((p) => ({ ...p, next: e.target.value })); setPwMsg(""); }}
              placeholder="6자 이상"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-jd-muted">새 비밀번호 확인</label>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => { setPw((p) => ({ ...p, confirm: e.target.value })); setPwMsg(""); }}
              className={inputClass}
            />
          </div>

          {pwMsg && (
            <p className={cn("text-center text-xs", pwOk ? "text-jd-yes" : "text-jd-no")}>{pwMsg}</p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving || !pw.current || !pw.next}
            className="w-full rounded-lg border border-white/[0.1] py-3 text-sm font-semibold text-jd-muted transition hover:bg-white/[0.04] disabled:opacity-40"
          >
            {saving ? "변경 중..." : "비밀번호 변경"}
          </button>
        </section>
      </div>
    </div>
  );
}
