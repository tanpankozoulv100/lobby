"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { formatParticipantNoDisplay } from "@/lib/format-participant-no";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import {
  mergeMatchLinks,
  subscribeInboundLinks,
  subscribeOutboundLinks,
} from "@/lib/firestore-connections";
import { matchTimestampMs } from "@/lib/match-link-times";
import { LOBBY_SEASON_UI } from "@/lib/season-config";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import type { DashboardTab } from "@/components/dashboard-bottom-nav";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";
import { ProfileEditSheet } from "@/components/profile-edit-sheet";
import { SettingsLinksSheet } from "@/components/settings-links-sheet";
import { useProfileMediaUrl } from "@/lib/use-profile-media-url";
import { countAnsweredQuestions } from "@/lib/compatibility-questions";

function ChevronRight() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  subtitleClassName,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-zinc-200/60 py-4 text-left last:border-b-0"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lobby-red)]/10 text-[var(--lobby-red)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-900">{title}</span>
        {subtitle ? (
          <span className={`mt-0.5 block text-xs ${subtitleClassName ?? "text-zinc-500"}`}>{subtitle}</span>
        ) : null}
      </span>
      <ChevronRight />
    </button>
  );
}

export function DashboardMypageTab({
  user,
  onSignOut,
  onNavigateTab,
}: {
  user: User;
  onSignOut: () => void;
  onNavigateTab: (tab: DashboardTab) => void;
}) {
  const { isStaff } = useLobbyStaff(user.uid);
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [recentMatchHint, setRecentMatchHint] = useState<string | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const avatarUrl = useProfileMediaUrl(profile?.avatarPath);
  const coverUrl = useProfileMediaUrl(profile?.coverPath);
  const compatAnswered = countAnsweredQuestions(profile?.compatibilityAnswers);

  useEffect(() => {
    if (!isFirebaseConfigComplete()) return;
    let unsub: (() => void) | null = null;
    void ensureUserProfile(user.uid, user.email).then(() => {
      unsub = subscribeUserProfile(user.uid, (p) => setProfile(p));
    });
    return () => unsub?.();
  }, [user.uid, user.email]);

  useEffect(() => {
    let outbound: Parameters<typeof mergeMatchLinks>[0] = [];
    let inbound: Parameters<typeof mergeMatchLinks>[1] = [];
    const sync = () => {
      const merged = mergeMatchLinks(outbound, inbound);
      setMatchCount(merged.length);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = merged.some((m) => {
        const ms = Math.max(
          matchTimestampMs(m.lastMatchedAt) ?? 0,
          matchTimestampMs(m.createdAt) ?? 0
        );
        return ms > weekAgo;
      });
      if (recent) {
        setRecentMatchHint("新たに一人とマッチングしました");
      } else if (merged.length > 0) {
        setRecentMatchHint(`マッチ数 ${merged.length}`);
      } else {
        setRecentMatchHint(null);
      }
    };
    const u1 = subscribeOutboundLinks(user.uid, (rows) => {
      outbound = rows;
      sync();
    });
    const u2 = subscribeInboundLinks(user.uid, (rows) => {
      inbound = rows;
      sync();
    });
    return () => {
      u1?.();
      u2?.();
    };
  }, [user.uid]);

  const displayName = profile?.displayName?.trim() || "ゲスト";
  const noLabel = formatParticipantNoDisplay(profile?.participantNo, isStaff);
  const inSeason = profile?.ticketRedeemedAt != null || isStaff;

  const historySubtitle = useMemo(() => {
    if (recentMatchHint) return recentMatchHint;
    if (matchCount > 0) return `マッチ数 ${matchCount}`;
    return "まだマッチがありません";
  }, [recentMatchHint, matchCount]);

  return (
    <div className="-mx-4 -mt-2">
      <h1 className="py-3 text-center font-serif text-lg font-semibold text-[var(--lobby-red)]">マイページ</h1>

      <div className="relative px-4 pb-2">
        <div
          className="h-28 overflow-hidden rounded-t-2xl bg-gradient-to-br from-[var(--lobby-red)]/30 via-zinc-300/40 to-[var(--lobby-cream)] bg-cover bg-center"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          aria-hidden
        />
        <div className="-mt-12 flex flex-col items-center">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-24 w-24 rounded-full border-4 border-[var(--lobby-cream)] object-cover shadow-md"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--lobby-cream)] bg-[var(--lobby-surface-raised)] text-2xl font-semibold text-[var(--lobby-red)] shadow-md">
                {displayName.slice(0, 1)}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileEditOpen(true)}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--lobby-cream)] bg-[var(--lobby-red)] text-white shadow"
              aria-label="プロフィールを編集"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-lg font-bold text-zinc-900">{displayName}</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-500">No.{noLabel}</p>
          {compatAnswered < 12 ? (
            <button
              type="button"
              onClick={() => setProfileEditOpen(true)}
              className="mt-2 text-xs text-[var(--lobby-red)] underline-offset-2 hover:underline"
            >
              相性質問 {compatAnswered}/12 — 続きを答える
            </button>
          ) : null}
        </div>
      </div>

      {inSeason ? (
        <p className="mx-4 mt-2 rounded-full border border-[var(--lobby-red)]/30 bg-[var(--lobby-surface-raised)] py-2.5 text-center text-sm font-medium text-[var(--lobby-red)]">
          シーズン参加中
        </p>
      ) : null}

      <nav className="mx-4 mt-4 rounded-2xl border border-zinc-200/80 bg-[var(--lobby-cream)] px-4 shadow-sm">
        <MenuRow
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
              <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          }
          title="マッチング履歴"
          subtitle={historySubtitle}
          subtitleClassName={recentMatchHint?.includes("新たに") ? "text-[var(--lobby-red)]" : undefined}
          onClick={() => onNavigateTab("history")}
        />
        <MenuRow
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="M12 3v2M12 19v2M3 12h2M19 12h2"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          }
          title="各種設定"
          subtitle="通知・利用規約など"
          onClick={() => setSettingsOpen(true)}
        />
        <MenuRow
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
          title="お問い合わせ・ヘルプ"
          onClick={() => setHelpOpen(true)}
        />
      </nav>

      <div className="mx-4 mt-6 flex flex-col gap-2 pb-4">
        <button
          type="button"
          onClick={() => onSignOut()}
          className="w-full rounded-xl border border-zinc-300/80 py-3 text-sm font-medium text-zinc-700"
        >
          ログアウト
        </button>
      </div>

      <ProfileEditSheet
        user={user}
        open={profileEditOpen}
        onClose={() => setProfileEditOpen(false)}
        previewDisplayName={displayName}
      />
      <SettingsLinksSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <LobbyBottomSheet open={helpOpen} title="お問い合わせ・ヘルプ" onClose={() => setHelpOpen(false)}>
        <div className="space-y-3 pt-2">
          <p className="text-sm leading-relaxed text-zinc-700">
            {LOBBY_SEASON_UI.cardTitle} に関するお問い合わせは、運営窓口までご連絡ください。
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            マッチングやチャットの不具合は、履歴タブから通報をご利用いただけます。
          </p>
        </div>
      </LobbyBottomSheet>
    </div>
  );
}
