"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import QRCode from "react-qr-code";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  ensureMyConnectionCode,
  subscribeMyConnectionCode,
} from "@/lib/firestore-connections";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import { formatConnectionCodeDisplay } from "@/lib/connection-code-display";
import {
  LOBBY_SEASON_UI,
  formatCountdownBanner,
  getSeasonRemainingDays,
} from "@/lib/season-config";
import { LobbyCameraScanModal } from "@/components/lobby-camera-scan-modal";
import { LobbyCodeInputModal } from "@/components/lobby-code-input-modal";

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        d="M8 8h10v6M8 8v10M40 8H30v6M40 8v10M8 40v-10h6M8 40h10M40 40H30v-10M40 40v-10h-6"
      />
      <rect x="18" y="18" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

type MatchFlow = "camera" | "code" | null;

export function DashboardHomeScreen({ user }: { user: User }) {
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [matchFlow, setMatchFlow] = useState<MatchFlow>(null);
  const daysLeft = getSeasonRemainingDays();

  useEffect(() => {
    let cancelled = false;
    let unsubProfile: (() => void) | null = null;

    void (async () => {
      if (!isFirebaseConfigComplete()) {
        if (!cancelled) {
          setProfileError("Firebase の設定を確認してください。");
          setProfileLoading(false);
        }
        return;
      }
      try {
        await ensureUserProfile(user.uid, user.email);
        await ensureMyConnectionCode(user.uid);
      } catch (e) {
        console.error("[Lobby] profile / connection code bootstrap:", e);
        if (!cancelled) {
          setProfileError("プロフィールの準備に失敗しました。しばらくしてからお試しください。");
          setProfileLoading(false);
        }
        return;
      }
      if (cancelled) return;
      unsubProfile = subscribeUserProfile(
        user.uid,
        (p) => {
          if (cancelled) return;
          setProfile(p);
          setProfileError(null);
          setProfileLoading(false);
        },
        (msg) => {
          if (cancelled) return;
          setProfileError(msg);
          setProfileLoading(false);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubProfile?.();
    };
  }, [user.uid, user.email]);

  useEffect(() => {
    const unsub = subscribeMyConnectionCode(
      user.uid,
      (c) => {
        setCode(c);
        setCodeErr(null);
      },
      (msg) => setCodeErr(msg)
    );
    return () => {
      unsub?.();
    };
  }, [user.uid]);

  if (profileLoading && !profileError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">読み込み中…</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        {profileError}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">
        プロフィールを読み込めませんでした。ページを再読み込みしてください。
      </div>
    );
  }

  const no = profile.participantNo ?? 0;
  const qrPayload = code ? `LOBBY:${code}` : "";

  return (
    <div className="space-y-0 pb-2">
      <div className="pt-2 text-center">
        <h1 className="text-base font-bold text-[var(--lobby-red)]">{LOBBY_SEASON_UI.headerTitle}</h1>
        <div className="mt-2 rounded-none bg-[var(--lobby-red)] py-2.5 text-center text-sm font-medium text-white">
          {formatCountdownBanner(daysLeft)}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-xl bg-white/90 px-3 py-3 shadow-sm">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(145deg,#c45c32,#8b3d1f)" }}
        >
          {daysLeft}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--lobby-red)]">{formatCountdownBanner(daysLeft)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{LOBBY_SEASON_UI.alertBody}</p>
        </div>
      </div>

      {codeErr ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{codeErr}</p>
      ) : null}

      <div className="mt-5 rounded-3xl border border-zinc-200/80 bg-[var(--lobby-cream)] px-5 pb-6 pt-5 shadow-md">
        <p className="font-serif text-2xl font-semibold text-[var(--lobby-red)]">Lobby</p>
        <p className="mt-1 text-sm font-semibold text-[var(--lobby-red)]">{LOBBY_SEASON_UI.cardTitle}</p>
        <p className="mt-0.5 text-xs text-[var(--lobby-red)]">{LOBBY_SEASON_UI.dateRangeLabel}</p>

        <div className="mt-6 text-center">
          <p className="font-serif text-6xl font-bold tabular-nums leading-none tracking-tight text-[var(--lobby-red)] md:text-7xl">
            No.{String(no).padStart(3, "0")}
          </p>

          {code ? (
            <div className="mt-6 flex flex-col items-center">
              <div className="rounded-2xl bg-white p-3 shadow-inner">
                <QRCode value={qrPayload} size={168} level="M" className="h-auto w-full max-w-[168px]" />
              </div>
              <p className="mt-4 text-xs font-medium text-zinc-600">マッチングコード</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-[var(--lobby-red)]">
                {formatConnectionCodeDisplay(code)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">相手にこのQRまたはコードを見せてください</p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-500">マッチングコードを準備中…</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMatchFlow("camera")}
          className="mt-8 flex w-full flex-col items-center rounded-2xl border border-[var(--lobby-red)]/25 bg-white/70 py-5 shadow-sm transition active:scale-[0.98]"
        >
          <ScanIcon className="h-12 w-12 text-[var(--lobby-red)]" />
          <span className="mt-2 text-sm font-semibold text-[var(--lobby-red)]">スキャン</span>
        </button>
      </div>

      <LobbyCameraScanModal
        open={matchFlow === "camera"}
        onClose={() => setMatchFlow(null)}
        uid={user.uid}
        onRequestCodeInput={() => setMatchFlow("code")}
      />

      <LobbyCodeInputModal
        open={matchFlow === "code"}
        onClose={() => setMatchFlow(null)}
        uid={user.uid}
        onBackToCamera={() => setMatchFlow("camera")}
      />
    </div>
  );
}
