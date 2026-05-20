"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  ensureUserProfile,
  subscribeUserProfile,
  updateUserProfile,
} from "@/lib/firestore-users";
import { GENDER_LABELS, JAPAN_PREFECTURES, computeAgeFromBirthDate, formatBirthDateJa } from "@/lib/lobby-profile";
import type { LobbyGender } from "@/lib/lobby-firestore-types";
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

function ProfileEditSheet({
  user,
  open,
  onClose,
}: {
  user: User;
  open: boolean;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      try {
        await ensureUserProfile(user.uid, user.email);
      } catch {
        if (!cancelled) setError("プロフィールの読み込みに失敗しました。");
        return;
      }
      unsub = subscribeUserProfile(
        user.uid,
        (data) => {
          if (cancelled) return;
          setDisplayName(data?.displayName ?? "");
          setBio(data?.bio ?? "");
          setPrefecture(data?.prefecture ?? "");
          setLegalName(data?.legalName ?? "");
          setGender(data?.gender ?? "");
          setBirthDate(data?.birthDate ?? "");
          setReady(true);
        },
        (msg) => {
          if (!cancelled) setError(msg);
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [open, user.uid, user.email]);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    setError(null);
    setSaving(true);
    const result = await updateUserProfile(user.uid, displayName, bio, prefecture);
    setSaving(false);
    if (result.ok) setSaveMessage("保存しました。");
    else setError(result.message);
  }, [user.uid, displayName, bio, prefecture]);

  return (
    <LobbyBottomSheet open={open} title="各種設定" onClose={onClose}>
      <div className="space-y-4 pt-2">
        {user.email ? (
          <p className="text-xs text-zinc-500">
            ログイン: <span className="text-zinc-800">{user.email}</span>
          </p>
        ) : null}
        {error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p> : null}
        {saveMessage ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{saveMessage}</p>
        ) : null}
        {ready ? (
          <>
            <div>
              <label htmlFor="mypage-display-name" className="mb-1 block text-xs font-medium text-zinc-600">
                表示名
              </label>
              <input
                id="mypage-display-name"
                type="text"
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="mypage-prefecture" className="mb-1 block text-xs font-medium text-zinc-600">
                居住地（都道府県）
              </label>
              <select
                id="mypage-prefecture"
                className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
              >
                <option value="">選択してください</option>
                {JAPAN_PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              <p>本名: {legalName || "—"}（変更不可）</p>
              <p className="mt-1">
                性別: {gender === "male" || gender === "female" ? GENDER_LABELS[gender as LobbyGender] : "—"}
                （変更不可）
              </p>
              <p className="mt-1">
                生年月日: {formatBirthDateJa(birthDate)}
                {birthDate && computeAgeFromBirthDate(birthDate) != null
                  ? `（${computeAgeFromBirthDate(birthDate)}歳）`
                  : ""}
                （変更不可）
              </p>
            </div>
            <div>
              <label htmlFor="mypage-bio" className="mb-1 block text-xs font-medium text-zinc-600">
                自己紹介（任意）
              </label>
              <textarea
                id="mypage-bio"
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full resize-y rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
          </>
        ) : (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        )}
      </div>
    </LobbyBottomSheet>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
          className="h-28 overflow-hidden rounded-t-2xl bg-gradient-to-br from-[var(--lobby-red)]/30 via-zinc-300/40 to-[var(--lobby-cream)]"
          aria-hidden
        />
        <div className="-mt-12 flex flex-col items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--lobby-cream)] bg-[var(--lobby-surface-raised)] text-2xl font-semibold text-[var(--lobby-red)] shadow-md">
              {displayName.slice(0, 1)}
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
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
        </div>
      </div>

      {inSeason ? (
        <p className="mx-4 mt-2 rounded-full bg-[var(--lobby-surface-raised)] py-2.5 text-center text-sm font-medium text-[var(--lobby-red)]">
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
          subtitle="表示名・自己紹介・アカウント"
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

      <ProfileEditSheet user={user} open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <LobbyBottomSheet open={helpOpen} title="お問い合わせ・ヘルプ" onClose={() => setHelpOpen(false)}>
        <div className="space-y-3 pt-2">
          <p className="text-sm leading-relaxed text-zinc-700">
            {LOBBY_SEASON_UI.cardTitle} に関するお問い合わせは、運営窓口までご連絡ください。
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            マッチングやチャットの不具合は、履歴タブから通報・ブロックもご利用いただけます。
          </p>
        </div>
      </LobbyBottomSheet>
    </div>
  );
}
