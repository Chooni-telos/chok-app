"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { value: "yesno", label: "O / X", desc: "두 가지 중 선택" },
  { value: "multichoice", label: "객관식", desc: "여러 선택지 중 선택" },
] as const;

export default function CreateGroupCardPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [cardType, setCardType] = useState("yesno");
  const [choices, setChoices] = useState(["", ""]);
  const [closesAt, setClosesAt] = useState("");
  const [resultAt, setResultAt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function addChoice() {
    setChoices((prev) => [...prev, ""]);
  }

  function updateChoice(idx: number, val: string) {
    setChoices((prev) => prev.map((c, i) => (i === idx ? val : c)));
  }

  function removeChoice(idx: number) {
    if (choices.length <= 2) return;
    setChoices((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setError("");
    if (!title.trim()) { setError("예측 질문을 입력해주세요."); return; }
    if (!closesAt) { setError("마감 시간을 설정해주세요."); return; }
    if (cardType === "multichoice") {
      const valid = choices.filter((c) => c.trim());
      if (valid.length < 2) { setError("선택지를 2개 이상 입력해주세요."); return; }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        card_type: cardType,
        closes_at: new Date(closesAt).toISOString(),
      };
      if (resultAt) body.result_announce_at = new Date(resultAt).toISOString();
      if (cardType === "multichoice") {
        body.choices = choices.filter((c) => c.trim());
      }
      await api.post(`/groups/${id}/cards`, body, token);
      router.push(`/groups/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "출제에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-jd-accent";
  const dateClass =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-jd-accent [color-scheme:dark]";

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/[0.08] bg-[#0b0a18]/95 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-jd-muted hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">예측 문제 출제</h1>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 pt-6">
        {/* 질문 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-jd-muted">예측 질문 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            placeholder="예: 오늘 민수가 학원에 지각할까?"
            maxLength={200}
            className={inputClass}
          />
        </div>

        {/* 유형 선택 */}
        <div>
          <label className="mb-2 block text-xs font-medium text-jd-muted">유형 선택</label>
          <div className="flex gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                onClick={() => setCardType(t.value)}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-center transition",
                  cardType === t.value
                    ? "border-jd-accent bg-jd-accent/10"
                    : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.06]",
                )}
              >
                <p className={cn("text-sm font-semibold", cardType === t.value ? "text-jd-accent" : "text-white")}>{t.label}</p>
                <p className="mt-0.5 text-[11px] text-jd-muted">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 객관식 선택지 */}
        {cardType === "multichoice" && (
          <div>
            <label className="mb-2 block text-xs font-medium text-jd-muted">선택지 (최소 2개)</label>
            <div className="space-y-2">
              {choices.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={c}
                    onChange={(e) => updateChoice(i, e.target.value)}
                    placeholder={`선택지 ${i + 1}`}
                    maxLength={50}
                    className={cn(inputClass, "flex-1")}
                  />
                  {choices.length > 2 && (
                    <button onClick={() => removeChoice(i)} className="px-2 text-jd-no hover:text-red-400">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addChoice} className="mt-2 text-xs text-jd-accent hover:underline">+ 선택지 추가</button>
          </div>
        )}

        {/* 마감 시간 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-jd-muted">마감 날짜 *</label>
            <input
              type="date"
              value={closesAt.split("T")[0] || ""}
              onChange={(e) => setClosesAt(e.target.value + "T" + (closesAt.split("T")[1] || "23:59"))}
              className={dateClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-jd-muted">마감 시간 *</label>
            <input
              type="time"
              value={closesAt.split("T")[1] || ""}
              onChange={(e) => setClosesAt((closesAt.split("T")[0] || "") + "T" + e.target.value)}
              className={dateClass}
            />
          </div>
        </div>

        {error && <p className="text-center text-xs text-jd-no">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-xl bg-jd-accent py-3 text-sm font-semibold text-white transition hover:bg-jd-accent/80 disabled:opacity-50"
        >
          {submitting ? "출제 중..." : "출제하기"}
        </button>
      </div>
    </div>
  );
}
