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
import type { PublishedAnnouncementRow } from "@/lib/firestore-announcements";
import { formatCountdownBanner } from "@/lib/season-config";
import { getSeasonRemainingDaysForDisplay, SEASON_FALLBACK_ID } from "@/lib/season-display";
import { useUserSeason } from "@/lib/use-user-season";
import { LobbyQrModal } from "@/components/lobby-qr-modal";
import { LobbyCameraScanModal } from "@/components/lobby-camera-scan-modal";
import { LobbyCodeInputModal } from "@/components/lobby-code-input-modal";
import { claimParticipantNumberOnLobbyOpen } from "@/lib/firestore-participant-no";
import { formatParticipantNoDisplay } from "@/lib/format-participant-no";
import { canUseLobbyDashboard } from "@/lib/onboarding-status";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import { DashboardHomeAnnouncements } from "@/components/dashboard-home-announcements";

function QrIcon({ className }: { className?: string }) {
  // 3つの位置検出パターン（角の四角）＋データモジュールで「QRコードらしさ」を出す
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="7" y="7" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <rect x="11" y="11" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="28" y="7" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <rect x="32" y="11" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="7" y="28" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <rect x="11" y="32" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="28" y="28" width="5" height="5" fill="currentColor" />
      <rect x="36" y="28" width="5" height="5" fill="currentColor" />
      <rect x="32" y="33" width="4" height="4" fill="currentColor" />
      <rect x="28" y="37" width="5" height="4" fill="currentColor" />
      <rect x="37" y="36" width="4" height="5" fill="currentColor" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="6" y="14" width="36" height="26" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M17 14l3-5h8l3 5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="24" cy="27" r="7" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

type MatchFlow = "camera" | "code" | null;

type HomeScreenProps = {
  user: User;
  announcementRows: PublishedAnnouncementRow[] | null;
  announcementHasUnread: boolean;
  onAnnouncementMarkSeen: () => void;
};

export function DashboardHomeScreen({
  user,
  announcementRows,
  announcementHasUnread,
  onAnnouncementMarkSeen,
}: HomeScreenProps) {
  const { isStaff, staffGateReady } = useLobbyStaff(user.uid);
  const bypassCtx = { isLobbyStaff: isStaff };
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [participantClaimError, setParticipantClaimError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [matchFlow, setMatchFlow] = useState<MatchFlow>(null);
  const { season } = useUserSeason(user.uid);
  const seasonRegistered = season.id !== SEASON_FALLBACK_ID;
  const daysLeft = getSeasonRemainingDaysForDisplay(season);

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

  useEffect(() => {
    if (!profile || !staffGateReady) return;
    if (!canUseLobbyDashboard(profile, user.uid, bypassCtx)) return;
    if (typeof profile.participantNo === "number") return;
    if (!isStaff && profile.ticketRedeemedAt != null) return;

    let cancelled = false;
    void (async () => {
      const res = await claimParticipantNumberOnLobbyOpen(user.uid, isStaff);
      if (cancelled) return;
      if (!res.ok) {
        setParticipantClaimError(res.message);
      } else {
        setParticipantClaimError(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, user.uid, isStaff, staffGateReady]);

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
      <div className="rounded-2xl border border-zinc-200 bg-[var(--lobby-cream)] px-4 py-4 text-sm text-zinc-600">
        プロフィールを読み込めませんでした。ページを再読み込みしてください。
      </div>
    );
  }

  const noLabel = formatParticipantNoDisplay(profile.participantNo, isStaff);
  const name = profile.displayName?.trim() || "ゲスト";

  return (
    <div className="space-y-0 pb-2">
      {isStaff && staffGateReady ? (
        <p
          role="status"
          className="mb-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-center text-sm font-medium text-violet-900"
        >
          管理者でログイン中
        </p>
      ) : null}

      <div className="pt-2 text-center">
        <h1 className="text-base font-bold text-[var(--lobby-red)]">{season.headerTitle}</h1>
        {seasonRegistered ? (
          <div className="mt-2 rounded-full border border-[var(--lobby-red)]/20 bg-[var(--lobby-surface-raised)] py-2.5 text-center text-sm font-medium text-[var(--lobby-red)]">
            {formatCountdownBanner(daysLeft)}
          </div>
        ) : null}
      </div>

      {participantClaimError ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{participantClaimError}</p>
      ) : null}
      {codeErr ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{codeErr}</p>
      ) : null}

      <DashboardHomeAnnouncements
        rows={announcementRows}
        hasUnread={announcementHasUnread}
        onMarkSeen={onAnnouncementMarkSeen}
      />

      <div className="mt-4 rounded-3xl border border-zinc-200/80 bg-[var(--lobby-cream)] px-5 pb-6 pt-5 shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/red/logotype_2_red.png"
          alt="Lobby"
          className="h-7 w-auto"
        />
        <p className="mt-2 text-sm font-semibold text-[var(--lobby-red)]">{season.cardTitle}</p>
        {season.dateRangeLabel ? (
          <p className="mt-0.5 text-xs text-[var(--lobby-red)]">{season.dateRangeLabel}</p>
        ) : null}

        <div className="mt-6 text-center">
          <p
            className="text-6xl font-bold tabular-nums leading-none tracking-tight text-[var(--lobby-red)] md:text-7xl"
            style={{ fontFamily: "var(--font-noto-serif-jp), serif" }}
          >
            No.{noLabel}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled={!code}
            onClick={() => setQrOpen(true)}
            className="flex flex-col items-center rounded-2xl border border-[var(--lobby-red)]/25 bg-[var(--lobby-surface-raised)] py-5 shadow-sm transition active:scale-[0.98] disabled:opacity-40"
          >
            <QrIcon className="h-12 w-12 text-[var(--lobby-red)]" />
            <span className="mt-2 text-sm font-semibold text-[var(--lobby-red)]">表示する</span>
          </button>
          <button
            type="button"
            onClick={() => setMatchFlow("camera")}
            className="flex flex-col items-center rounded-2xl border border-[var(--lobby-red)]/25 bg-[var(--lobby-surface-raised)] py-5 shadow-sm transition active:scale-[0.98]"
          >
            <CameraIcon className="h-12 w-12 text-[var(--lobby-red)]" />
            <span className="mt-2 text-sm font-semibold text-[var(--lobby-red)]">スキャン</span>
          </button>
        </div>
      </div>

      <LobbyQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        connectionCode={code ?? ""}
        displayName={name}
        seasonCardTitle={season.cardTitle}
        seasonDateLabel={season.dateRangeLabel}
      />

      <LobbyCameraScanModal
        open={matchFlow === "camera"}
        onClose={() => setMatchFlow(null)}
        uid={user.uid}
        onRequestCodeInput={() => setMatchFlow("code")}
        bypassCooldown={isStaff}
      />

      <LobbyCodeInputModal
        open={matchFlow === "code"}
        onClose={() => setMatchFlow(null)}
        uid={user.uid}
        onBackToCamera={() => setMatchFlow("camera")}
        bypassCooldown={isStaff}
      />
    </div>
  );
}
