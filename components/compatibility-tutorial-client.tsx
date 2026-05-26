"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  ensureUserProfile,
  subscribeUserProfile,
  updateUserProfilePresentation,
} from "@/lib/firestore-users";
import {
  COMPATIBILITY_QUESTIONS,
  COMPATIBILITY_QUESTION_COUNT,
  type CompatibilityAnswers,
  type CompatibilityQuestionId,
} from "@/lib/compatibility-questions";
import {
  getPostLobbyEntryPath,
  isCompatibilityTutorialComplete,
  isLobbyAccessGranted,
  isOnboardingBypassActiveForUser,
} from "@/lib/onboarding-status";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";

export function CompatibilityTutorialClient({ user }: { user: User }) {
  const router = useRouter();
  const { isStaff, staffGateReady } = useLobbyStaff(user.uid);
  const bypassCtx = { isLobbyStaff: isStaff };
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<CompatibilityAnswers>({});
  const [saving, setSaving] = useState(false);
  const [stepInitialized, setStepInitialized] = useState(false);

  const currentQuestion = COMPATIBILITY_QUESTIONS[stepIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isLastStep = stepIndex === COMPATIBILITY_QUESTION_COUNT - 1;

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    void (async () => {
      if (!isFirebaseConfigComplete()) {
        if (!cancelled) {
          setError("Firebase の設定を確認してください。");
          setLoading(false);
        }
        return;
      }
      try {
        await ensureUserProfile(user.uid, user.email);
      } catch {
        if (!cancelled) {
          setError("プロフィールの読み込みに失敗しました。");
          setLoading(false);
        }
        return;
      }
      unsub = subscribeUserProfile(
        user.uid,
        (p) => {
          if (cancelled) return;
          setProfile(p);
          setAnswers(p?.compatibilityAnswers ?? {});
          setError(null);
          setLoading(false);
        },
        (msg) => {
          if (cancelled) return;
          setError(msg);
          setLoading(false);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user.uid, user.email]);

  useEffect(() => {
    if (!staffGateReady || loading) return;
    if (!isLobbyAccessGranted(profile, user.uid, bypassCtx)) {
      router.replace("/onboarding");
      return;
    }
    if (isCompatibilityTutorialComplete(profile, user.uid, bypassCtx)) {
      router.replace("/dashboard");
    }
  }, [loading, profile, router, user.uid, staffGateReady, isStaff]);

  const firstUnansweredIndex = useMemo(() => {
    const idx = COMPATIBILITY_QUESTIONS.findIndex((q) => !answers[q.id]);
    return idx === -1 ? 0 : idx;
  }, [answers]);

  useEffect(() => {
    if (loading || stepInitialized) return;
    setStepIndex(firstUnansweredIndex);
    setStepInitialized(true);
  }, [loading, firstUnansweredIndex, stepInitialized]);

  const setAnswer = useCallback((qid: CompatibilityQuestionId, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));
  }, []);

  const goNext = useCallback(() => {
    if (!currentQuestion || !currentAnswer) return;
    if (!isLastStep) {
      setStepIndex((i) => Math.min(i + 1, COMPATIBILITY_QUESTION_COUNT - 1));
    }
  }, [currentQuestion, currentAnswer, isLastStep]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleComplete = useCallback(async () => {
    if (!profile) return;
    for (const q of COMPATIBILITY_QUESTIONS) {
      if (!answers[q.id]) {
        setError(`Q${COMPATIBILITY_QUESTIONS.indexOf(q) + 1} に回答してください。`);
        setStepIndex(COMPATIBILITY_QUESTIONS.indexOf(q));
        return;
      }
    }
    setError(null);
    setSaving(true);
    const result = await updateUserProfilePresentation(user.uid, profile.bio ?? "", answers);
    setSaving(false);
    if (result.ok) {
      router.replace("/dashboard");
    } else {
      setError(result.message);
    }
  }, [profile, answers, user.uid, router]);

  if (loading) {
    return <p className="text-center text-sm text-zinc-500">読み込み中…</p>;
  }

  if (error && !profile) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const progressPercent = Math.round(((stepIndex + 1) / COMPATIBILITY_QUESTION_COUNT) * 100);

  return (
    <div className="space-y-6 text-left">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--lobby-red)]">チュートリアル</p>
        <h1 className="mt-1 font-serif text-xl font-semibold text-zinc-900">相性質問</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          マッチした相手との相性％表示に使います。12問すべて選択式でお答えください。あとからマイページで変更できます。
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {stepIndex + 1} / {COMPATIBILITY_QUESTION_COUNT}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-[var(--lobby-red)] transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-zinc-900">
          Q{stepIndex + 1}. {currentQuestion.label}
        </legend>
        <ul className="space-y-2">
          {currentQuestion.options.map((opt) => {
            const selected = currentAnswer === opt.id;
            return (
              <li key={opt.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                    selected
                      ? "border-[var(--lobby-red)] bg-[var(--lobby-red)]/5 text-zinc-900"
                      : "border-zinc-200 bg-[var(--lobby-surface-raised)] text-zinc-800"
                  }`}
                >
                  <input
                    type="radio"
                    name={`compat-${currentQuestion.id}`}
                    value={opt.id}
                    checked={selected}
                    onChange={() => setAnswer(currentQuestion.id, opt.id)}
                    className="mt-0.5 shrink-0 accent-[var(--lobby-red)]"
                  />
                  <span className="leading-snug">{opt.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={stepIndex === 0 || saving}
          onClick={goBack}
          className="flex-1 rounded-full border border-zinc-300 py-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
        >
          戻る
        </button>
        {isLastStep ? (
          <button
            type="button"
            disabled={!currentAnswer || saving}
            onClick={() => void handleComplete()}
            className="flex-[2] rounded-full bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "保存中…" : "完了してはじめる"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!currentAnswer || saving}
            onClick={goNext}
            className="flex-[2] rounded-full bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            次へ
          </button>
        )}
      </div>

      {isOnboardingBypassActiveForUser(user.uid, bypassCtx) ? (
        <p className="text-center text-xs text-zinc-500">
          <button
            type="button"
            className="text-[var(--lobby-red)] underline-offset-2 hover:underline"
            onClick={() => router.replace(getPostLobbyEntryPath(profile, user.uid, bypassCtx))}
          >
            ダッシュボードへ（運営・開発用）
          </button>
        </p>
      ) : null}
    </div>
  );
}
