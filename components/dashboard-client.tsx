"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseDb, isFirebaseConfigComplete } from "@/lib/firebase";
import {
  subscribePublishedEvents,
  type PublishedEventRow,
} from "@/lib/firestore-events";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import {
  isAccountSuspended,
  isCompatibilityTutorialComplete,
  isLobbyAccessGranted,
  isOnboardingBypassActiveForUser,
} from "@/lib/onboarding-status";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import { DashboardMypageTab } from "@/components/dashboard-mypage-tab";
import { DashboardEventsSection } from "@/components/dashboard-events-section";
import { DashboardConnectionsSection } from "@/components/dashboard-connections-section";
import { DashboardChatSection } from "@/components/dashboard-chat-section";
import { DashboardBottomNav, type DashboardTab } from "@/components/dashboard-bottom-nav";
import { DashboardHomeScreen } from "@/components/dashboard-home-screen";
import { DashboardSuspendedScreen } from "@/components/dashboard-suspended-screen";
import { useAnnouncementUnread } from "@/lib/use-announcement-unread";

function eventSnapshotErrorHint(code: string): string {
  if (code === "failed-precondition")
    return "composite index（isPublished + startsAt）が要。案内のリンクで作成";
  if (code === "permission-denied") return "ルール又は認証";
  if (code === "unavailable") return "getFirebaseApp / env";
  if (code === "unknown") return "詳細は Console エラーを参照";
  return "Firebase クライアント用エラーコード";
}

type EventsSubDebug = {
  line: string;
  queryDocCount?: number;
  listLen?: number;
  errCode?: string;
};

function DashboardEventsDebugPanel({
  eventsSubDebug,
  className = "bottom-2",
  configOk,
  profileGateReady,
  hasDb,
}: {
  eventsSubDebug: EventsSubDebug;
  className?: string;
  configOk: boolean;
  profileGateReady: boolean;
  hasDb: boolean;
}) {
  return (
    <div
      className={`fixed left-2 right-2 z-50 max-h-40 max-w-lg overflow-y-auto rounded-lg border border-amber-500/40 bg-zinc-950/95 p-2 font-mono text-[10px] leading-snug text-amber-50/95 shadow-lg [text-wrap:pretty] [margin-inline:auto] ${className}`}
    >
      <p className="text-[11px] font-semibold text-amber-200">
        Lobby デバッグ（ローカル next dev は常に表示。本番で使うには LOBBY_DEBUG=1）
      </p>
      <p className="mt-0.5 break-all">
        project: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "—"}
      </p>
      <p>
        env 完備: {configOk ? "ok" : "ng"} / profile ゲート: {String(profileGateReady)} / getFirebaseDb:{" "}
        {hasDb ? "ok" : "null"}
      </p>
      <p>
        {eventsSubDebug.line}
        {eventsSubDebug.queryDocCount != null
          ? ` ・ クエリ${eventsSubDebug.queryDocCount}件 → 一覧${
              eventsSubDebug.listLen ?? 0
            }件（数が違う → title 空・isPublished≠bool true・startsAt 不備）`
          : ""}
        {eventsSubDebug.errCode
          ? ` ・ [${eventsSubDebug.errCode}] ${eventSnapshotErrorHint(eventsSubDebug.errCode)}`
          : ""}
      </p>
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const { signOutUser } = useAuth();
  const { isStaff, staffGateReady } = useLobbyStaff(user?.uid ?? null);
  const bypassCtx = { isLobbyStaff: isStaff };
  const [tab, setTab] = useState<DashboardTab>("home");
  const {
    rows: announcementRows,
    hasUnread: homeAnnouncementUnread,
    markSeen: markAnnouncementsRead,
  } = useAnnouncementUnread(user?.uid ?? null);
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [profileGateReady, setProfileGateReady] = useState(() => !isFirebaseConfigComplete());
  const [publishedEvents, setPublishedEvents] = useState<PublishedEventRow[] | null>(null);
  /** `next dev` では常に true（.env 未反映で帯が出ないトラブルを防ぐ）。本番は LOBBY_DEBUG=1 のときのみ。 */
  const showEventsDebug =
    process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_LOBBY_DEBUG === "1";
  const [eventsSubDebug, setEventsSubDebug] = useState<EventsSubDebug>({ line: "起動" });

  useEffect(() => {
    if (loading || !user) {
      if (showEventsDebug) {
        startTransition(() => {
          setEventsSubDebug((d) => ({ ...d, line: "待ち: 認証" }));
        });
      }
      return;
    }
    if (!isFirebaseConfigComplete() || !profileGateReady) {
      if (showEventsDebug) {
        startTransition(() => {
          setEventsSubDebug({
            line: !isFirebaseConfigComplete()
              ? "未購読: NEXT_PUBLIC_FIREBASE_* 不足"
              : "未購読: profile ゲート前",
          });
        });
      }
      return;
    }
    if (showEventsDebug && !getFirebaseDb()) {
      startTransition(() => {
        setEventsSubDebug({ line: "getFirebaseDb()=null" });
      });
    }
    const unsub = subscribePublishedEvents(
      (list, meta) => {
        setPublishedEvents(list);
        if (showEventsDebug) {
          setEventsSubDebug({
            line: "onSnapshot 成功",
            queryDocCount: meta?.queryDocCount,
            listLen: list.length,
            errCode: undefined,
          });
        }
      },
      (errCode) => {
        startTransition(() => {
          setPublishedEvents([]);
          if (showEventsDebug) {
            setEventsSubDebug({
              line: "onSnapshot 失敗",
              errCode,
            });
          }
        });
      }
    );
    if (!unsub) {
      startTransition(() => {
        setPublishedEvents([]);
        if (showEventsDebug) {
          setEventsSubDebug({ line: "subscribe null（unavailable）", errCode: "unavailable" });
        }
      });
      return;
    }
    if (showEventsDebug) {
      startTransition(() => {
        setEventsSubDebug((d) => ({ ...d, line: "購読中…" }));
      });
    }
    return () => {
      unsub();
    };
  }, [user, loading, profileGateReady, showEventsDebug]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    if (loading || !user) {
      return;
    }
    if (!isFirebaseConfigComplete()) {
      return;
    }

    void (async () => {
      try {
        await ensureUserProfile(user.uid, user.email);
      } catch (e) {
        console.error("[Lobby] dashboard ensureUserProfile:", e);
        if (!cancelled) setProfileGateReady(true);
        return;
      }
      if (cancelled) return;
      unsub = subscribeUserProfile(
        user.uid,
        (p) => {
          if (cancelled) return;
          setProfile(p);
          setProfileGateReady(true);
        },
        () => {
          if (cancelled) return;
          setProfileGateReady(true);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user, loading]);

  useEffect(() => {
    if (loading || !user || !profileGateReady || !staffGateReady) return;
    if (!isFirebaseConfigComplete()) return;
    if (isOnboardingBypassActiveForUser(user.uid, bypassCtx)) return;
    if (profile && isAccountSuspended(profile)) return;
    if (profile && !isLobbyAccessGranted(profile, user.uid, bypassCtx)) {
      router.replace("/onboarding");
      return;
    }
    if (
      profile &&
      isLobbyAccessGranted(profile, user.uid, bypassCtx) &&
      !isCompatibilityTutorialComplete(profile, user.uid, bypassCtx)
    ) {
      router.replace("/tutorial");
    }
  }, [loading, user, profile, profileGateReady, staffGateReady, router, isStaff]);

  if (loading || !user) {
    return (
      <div className="relative min-h-dvh flex-1 bg-[var(--lobby-screen-bg)]">
        <div className="flex min-h-dvh items-center justify-center px-6 py-24">
          <p className="text-sm text-zinc-500">読み込み中…</p>
        </div>
        {showEventsDebug ? (
          <DashboardEventsDebugPanel
            eventsSubDebug={eventsSubDebug}
            className="bottom-2"
            configOk={isFirebaseConfigComplete()}
            profileGateReady={profileGateReady}
            hasDb={!!getFirebaseDb()}
          />
        ) : null}
      </div>
    );
  }

  if (
    isFirebaseConfigComplete() &&
    profileGateReady &&
    profile &&
    isAccountSuspended(profile) &&
    !isOnboardingBypassActiveForUser(user.uid, bypassCtx)
  ) {
    return (
      <div className="relative min-h-dvh flex-1 bg-[var(--lobby-screen-bg)]">
        <DashboardSuspendedScreen onSignOut={() => void signOutUser()} />
        {showEventsDebug ? (
          <DashboardEventsDebugPanel
            eventsSubDebug={eventsSubDebug}
            className="bottom-2"
            configOk={isFirebaseConfigComplete()}
            profileGateReady={profileGateReady}
            hasDb={!!getFirebaseDb()}
          />
        ) : null}
      </div>
    );
  }

  if (
    isFirebaseConfigComplete() &&
    profileGateReady &&
    staffGateReady &&
    profile &&
    !isLobbyAccessGranted(profile, user.uid, bypassCtx)
  ) {
    return (
      <div className="relative min-h-dvh flex-1 bg-[var(--lobby-screen-bg)]">
        <div className="flex min-h-dvh items-center justify-center px-6 py-24">
          <p className="text-sm text-zinc-500">利用開始の確認へ移動しています…</p>
        </div>
        {showEventsDebug ? (
          <DashboardEventsDebugPanel
            eventsSubDebug={eventsSubDebug}
            className="bottom-2"
            configOk={isFirebaseConfigComplete()}
            profileGateReady={profileGateReady}
            hasDb={!!getFirebaseDb()}
          />
        ) : null}
      </div>
    );
  }

  if (
    isFirebaseConfigComplete() &&
    profileGateReady &&
    staffGateReady &&
    profile &&
    isLobbyAccessGranted(profile, user.uid, bypassCtx) &&
    !isCompatibilityTutorialComplete(profile, user.uid, bypassCtx)
  ) {
    return (
      <div className="relative min-h-dvh flex-1 bg-[var(--lobby-screen-bg)]">
        <div className="flex min-h-dvh items-center justify-center px-6 py-24">
          <p className="text-sm text-zinc-500">相性質問へ移動しています…</p>
        </div>
        {showEventsDebug ? (
          <DashboardEventsDebugPanel
            eventsSubDebug={eventsSubDebug}
            className="bottom-2"
            configOk={isFirebaseConfigComplete()}
            profileGateReady={profileGateReady}
            hasDb={!!getFirebaseDb()}
          />
        ) : null}
      </div>
    );
  }

  const showBrandHeader = tab !== "home" && tab !== "mypage" && tab !== "chat";

  return (
    <div className="min-h-dvh bg-[var(--lobby-screen-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      {showBrandHeader ? (
        <header className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-200/80 bg-[var(--lobby-cream)]/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-center px-4">
            <button
              type="button"
              onClick={() => setTab("home")}
              className="relative block h-10 w-36 shrink-0 border-0 bg-transparent p-0"
              aria-label="Lobby ホームへ"
            >
              <Image
                src="/assets/logo-lobby.png"
                alt="Lobby"
                fill
                className="object-contain object-center"
                sizes="144px"
              />
            </button>
          </div>
        </header>
      ) : null}

      <main
        className={
          showBrandHeader
            ? "mx-auto max-w-lg px-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-6"
            : "mx-auto max-w-lg px-4 pt-[env(safe-area-inset-top)] pb-6"
        }
      >
        {tab === "home" ? (
          <DashboardHomeScreen
            user={user}
            announcementRows={announcementRows}
            announcementHasUnread={homeAnnouncementUnread}
            onAnnouncementMarkSeen={markAnnouncementsRead}
          />
        ) : null}
        {tab === "history" ? (
          <div className="space-y-4">
            <DashboardConnectionsSection user={user} />
          </div>
        ) : null}
        {tab === "chat" ? <DashboardChatSection user={user} /> : null}
        {tab === "event" ? (
          <div className="space-y-4">
            <DashboardEventsSection
              user={user}
              publishedEvents={publishedEvents}
              cohortFlipActive={profile?.cohortFlipActive === true}
            />
          </div>
        ) : null}
        {tab === "mypage" ? (
          <DashboardMypageTab
            user={user}
            onSignOut={signOutUser}
            onNavigateTab={setTab}
          />
        ) : null}
      </main>

      {showEventsDebug ? (
        <DashboardEventsDebugPanel
          eventsSubDebug={eventsSubDebug}
          className="bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
          configOk={isFirebaseConfigComplete()}
          profileGateReady={profileGateReady}
          hasDb={!!getFirebaseDb()}
        />
      ) : null}
      <DashboardBottomNav
        active={tab}
        onChange={setTab}
        homeHasUnread={homeAnnouncementUnread}
      />
    </div>
  );
}
