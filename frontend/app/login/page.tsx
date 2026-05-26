"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? "";

function getKakaoAuthUrl() {
  const redirectUri = `${window.location.origin}/login/callback`;
  const params = new URLSearchParams({
    client_id: KAKAO_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  return `https://kauth.kakao.com/oauth/authorize?${params}`;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login("local", username, undefined, password);
      router.push("/");
    } catch {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleKakaoLogin() {
    window.location.href = getKakaoAuthUrl();
  }

  async function handleDevLogin() {
    setLoading(true);
    try {
      await login("dev", "dev-local-user");
      router.push("/");
    } catch {
      alert("로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const kakaoEnabled = !!KAKAO_CLIENT_ID;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold">
          <span className="tier-title">촉</span>
        </h1>
        <p className="text-jd-muted">내 촉이 맞을까?</p>
        <p className="mt-1 text-sm text-jd-muted">미래를 맞춰봐. 당신의 예지력은 몇 점?</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        {/* 일반 로그인 */}
        <form onSubmit={handleLocalLogin} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            placeholder="아이디"
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-jd-accent focus:ring-1 focus:ring-jd-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="비밀번호"
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-jd-accent focus:ring-1 focus:ring-jd-accent"
          />
          {error && <p className="text-center text-xs text-jd-no">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-jd-accent py-3 text-sm font-semibold text-white transition hover:bg-jd-accent/80 disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-xs text-jd-muted">
          계정이 없으신가요?{" "}
          <Link href="/register" className="font-semibold text-jd-accent hover:underline">
            회원가입
          </Link>
        </p>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-xs text-jd-muted">소셜 로그인</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <button
          onClick={handleKakaoLogin}
          disabled={!kakaoEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] py-3 text-sm font-semibold text-[#3C1E1E] transition hover:bg-[#FEE500]/80 disabled:opacity-50"
        >
          카카오로 시작하기
        </button>

        <button
          onClick={handleDevLogin}
          disabled={loading}
          className="w-full rounded-lg border border-white/[0.1] py-3 text-sm font-medium text-jd-muted transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          개발 모드 로그인
        </button>
      </div>
    </div>
  );
}
