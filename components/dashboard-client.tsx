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
import { isDevOnboardingBypassEnabled, isAccountSuspended, isLobbyAccessGranted } from "@/lib/onboarding-status";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import { DashboardProfileSection } from "@/components/dashboard-profile-section";
import { DashboardAnnouncementsSection } from "@/components/dashboard-announcements-section";
import { DashboardEventsSection } from "@/components/dashboard-events-section";
import { DashboardConnectionsSection } from "@/components/dashboard-connections-section";
import { DashboardBoardSection } from "@/components/dashboard-board-section";
import { DashboardBottomNav, type DashboardTab } from "@/components/dashboard-bottom-nav";
import { DashboardHomeScreen } from "@/components/dashboard-home-screen";
import { DashboardSuspendedScreen } from "@/components/dashboard-suspended-screen";

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

function DashboardMypageTab({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-zinc-900">アカウント</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">メール</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">ユーザーID</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-zinc-700">{user.uid}</dd>
          </div>
        </dl>
      </section>
      <DashboardProfileSection user={user} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          トップへ
        </Link>
        <button
          type="button"
          onClick={() => onSignOut()}
          className="inline-flex justify-center rounded-xl bg-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-300"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const { signOutUser } = useAuth();
  const [tab, setTab] = useState<DashboardTab>("home");
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
    if (loading || !user || !profileGateReady) return;
    if (!isFirebaseConfigComplete()) return;
    if (isDevOnboardingBypassEnabled()) return;
    if (profile && isAccountSuspended(profile)) return;
    if (profile && !isLobbyAccessGranted(profile)) {
      router.replace("/onboarding");
    }
  }, [loading, user, profile, profileGateReady, router]);

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
    !isDevOnboardingBypassEnabled()
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
    profile &&
    !isLobbyAccessGranted(profile) &&
    !isDevOnboardingBypassEnabled()
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

  const showBrandHeader = tab !== "home";

  return (
    <div className="min-h-dvh bg-[var(--lobby-screen-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      {showBrandHeader ? (
        <header className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-200/80 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-sm">
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
        {tab === "home" ? <DashboardHomeScreen user={user} /> : null}
        {tab === "history" ? (
          <div className="space-y-4">
            <DashboardConnectionsSection user={user} />
          </div>
        ) : null}
        {tab === "news" ? (
          <div className="space-y-4">
            <DashboardAnnouncementsSection />
          </div>
        ) : null}
        {tab === "chat" ? (
          <div className="space-y-4">
            <DashboardBoardSection user={user} />
          </div>
        ) : null}
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
          <DashboardMypageTab user={user} onSignOut={signOutUser} />
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
      <DashboardBottomNav active={tab} onChange={setTab} />
    </div>
  );
}
