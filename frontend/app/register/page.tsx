"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대 이상"] as const;
const GENDERS = ["남성", "여성"] as const;
const INTEREST_TOPICS = ["시사", "스포츠", "엔터테인먼트", "경제테크", "도파민"] as const;

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    password: "",
    passwordConfirm: "",
    nickname: "",
    email: "",
    age_group: "",
    gender: "",
    interests: [] as string[],
  });
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "username") setUsernameStatus("idle");
    setError("");
  }

  async function checkUsername() {
    if (form.username.length < 4) {
      setError("아이디는 4자 이상이어야 합니다.");
      return;
    }
    setUsernameStatus("checking");
    try {
      const res = await api.post<{ available: boolean }>("/auth/check-username", { username: form.username });
      setUsernameStatus(res.available ? "available" : "taken");
      if (!res.available) setError("이미 사용 중인 아이디입니다.");
    } catch {
      setUsernameStatus("idle");
      setError("중복 확인에 실패했습니다.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (usernameStatus !== "available") {
      setError("아이디 중복 확인을 해주세요.");
      return;
    }
    if (form.password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (form.nickname.length < 2) {
      setError("닉네임은 2자 이상이어야 합니다.");
      return;
    }
    if (!form.email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!form.age_group) {
      setError("연령대를 선택해주세요.");
      return;
    }
    if (!form.gender) {
      setError("성별을 선택해주세요.");
      return;
    }
    if (form.interests.length === 0) {
      setError("관심주제를 1개 이상 선택해주세요.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        username: form.username,
        password: form.password,
        nickname: form.nickname,
        email: form.email,
        age_group: form.age_group,
        gender: form.gender,
        interests: form.interests,
      });
      await login("local", form.username, undefined, form.password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("회원가입에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-jd-accent focus:ring-1 focus:ring-jd-accent";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="mb-1 text-2xl font-bold">
          <span className="tier-title">촉</span> <span className="text-white">회원가입</span>
        </h1>
        <p className="text-sm text-jd-muted">예지력을 측정할 준비가 되셨나요?</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {/* 아이디 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-jd-muted">아이디</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="영문, 숫자, _ (4자 이상)"
              className={cn(inputClass, "flex-1")}
            />
            <button
              type="button"
              onClick={checkUsername}
              disabled={form.username.length < 4 || usernameStatus === "checking"}
              className="shrink-0 rounded-lg bg-jd-accent px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-jd-accent/80 disabled:opacity-40"
            >
              {usernameStatus === "checking" ? "확인 중..." : "중복확인"}
            </button>
          </div>
          {usernameStatus === "available" && (
            <p className="mt-1 text-xs text-jd-yes">사용 가능한 아이디입니다.</p>
          )}
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-jd-muted">비밀번호</label>
          <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="6자 이상" className={inputClass} />
        </div>

        {/* 비밀번호 확인 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-jd-muted">비밀번호 확인</label>
          <input type="password" value={form.passwordConfirm} onChange={(e) => update("passwordConfirm", e.target.value)} placeholder="비밀번호 재입력" className={inputClass} />
        </div>

        {/* 닉네임 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-jd-muted">닉네임</label>
          <input type="text" value={form.nickname} onChange={(e) => update("nickname", e.target.value)} placeholder="2~20자" className={inputClass} />
        </div>

        {/* 이메일 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-jd-muted">이메일</label>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="example@email.com" className={inputClass} />
        </div>

        {/* 연령대 */}
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
                  form.age_group === ag ? "bg-jd-accent text-white" : "bg-white/[0.06] text-jd-muted hover:bg-white/[0.1]"
                )}
              >
                {ag}
              </button>
            ))}
          </div>
        </div>

        {/* 성별 */}
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
                  form.gender === g ? "bg-jd-accent text-white" : "bg-white/[0.06] text-jd-muted hover:bg-white/[0.1]"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 관심주제 */}
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
                    setError("");
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

        {error && <p className="text-center text-xs text-jd-no">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-jd-accent py-3 text-sm font-semibold text-white transition hover:bg-jd-accent/80 disabled:opacity-50"
        >
          {loading ? "가입 중..." : "회원가입"}
        </button>

        <p className="text-center text-xs text-jd-muted">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-jd-accent hover:underline">
            로그인
          </Link>
        </p>
      </form>
    </div>
  );
}
