"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  ensureMyConnectionCode,
  subscribeMyConnectionCode,
} from "@/lib/firestore-connections";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import {
  LOBBY_SEASON_UI,
  formatCountdownBanner,
  getSeasonRemainingDays,
} from "@/lib/season-config";
import { LobbyQrModal } from "@/components/lobby-qr-modal";
import { LobbyScanModal } from "@/components/lobby-scan-modal";

function QrIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2.5"
        d="M6 6h12v12H6V6zm0 24h12v12H6V30zm24-24h12v12H30V6z"
      />
      <rect x="30" y="30" width="4" height="4" fill="currentColor" rx="1" />
      <rect x="38" y="30" width="4" height="4" fill="currentColor" rx="1" />
      <rect x="30" y="38" width="4" height="4" fill="currentColor" rx="1" />
      <rect x="38" y="38" width="4" height="4" fill="currentColor" rx="1" />
    </svg>
  );
}

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

export function DashboardHomeScreen({ user }: { user: User }) {
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">{profileError}</div>
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
  const serial = profile.participantSerial ?? "—";
  const name = profile.displayName?.trim() || "ゲスト";

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
          <p className="text-sm font-bold text-[var(--lobby-red)]">
            {formatCountdownBanner(daysLeft)}
          </p>
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
          <p className="mt-3 text-sm font-medium text-[var(--lobby-red)]">{serial}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled={!code}
            onClick={() => setQrOpen(true)}
            className="flex flex-col items-center rounded-2xl border border-[var(--lobby-red)]/25 bg-white/70 py-5 shadow-sm transition active:scale-[0.98] disabled:opacity-40"
          >
            <QrIcon className="h-12 w-12 text-[var(--lobby-red)]" />
            <span className="mt-2 text-sm font-semibold text-[var(--lobby-red)]">表示する</span>
          </button>
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="flex flex-col items-center rounded-2xl border border-[var(--lobby-red)]/25 bg-white/70 py-5 shadow-sm transition active:scale-[0.98]"
          >
            <ScanIcon className="h-12 w-12 text-[var(--lobby-red)]" />
            <span className="mt-2 text-sm font-semibold text-[var(--lobby-red)]">スキャン</span>
          </button>
        </div>
      </div>

      <LobbyQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        connectionCode={code ?? ""}
        displayName={name}
        participantSerial={serial}
        seasonCardTitle={LOBBY_SEASON_UI.cardTitle}
        seasonDateLabel={LOBBY_SEASON_UI.dateRangeLabel}
      />

      <LobbyScanModal open={scanOpen} onClose={() => setScanOpen(false)} uid={user.uid} />
    </div>
  );
}
