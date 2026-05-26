"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

function CallbackHandler() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError || !code) {
      setError(oauthError ?? "인증 코드를 받지 못했습니다.");
      return;
    }

    const redirectUri = `${window.location.origin}/login/callback`;

    login("kakao", code, redirectUri)
      .then(() => router.replace("/"))
      .catch(() => setError("로그인에 실패했습니다. 다시 시도해주세요."));
  }, [searchParams, login, router]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-jd-muted">{error}</p>
        <button
          onClick={() => router.replace("/login")}
          className="rounded-lg bg-jd-accent px-6 py-2 text-sm font-semibold text-white"
        >
          로그인으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-jd-muted">로그인 처리 중...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><p className="text-jd-muted">로그인 처리 중...</p></div>}>
      <CallbackHandler />
    </Suspense>
  );
}
