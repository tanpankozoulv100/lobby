"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { User } from "firebase/auth";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/components/auth-provider";
import { DashboardProfileSection } from "@/components/dashboard-profile-section";
import { DashboardAnnouncementsSection } from "@/components/dashboard-announcements-section";
import { DashboardEventsSection } from "@/components/dashboard-events-section";
import { DashboardConnectionsSection } from "@/components/dashboard-connections-section";
import { DashboardBoardSection } from "@/components/dashboard-board-section";
import { DashboardBottomNav, type DashboardTab } from "@/components/dashboard-bottom-nav";
import { DashboardHomeScreen } from "@/components/dashboard-home-screen";

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
  const { user, loading } = useRequireAuth();
  const { signOutUser } = useAuth();
  const [tab, setTab] = useState<DashboardTab>("home");

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-[var(--lobby-screen-bg)] px-6 py-24">
        <p className="text-sm text-zinc-500">読み込み中…</p>
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
            <DashboardEventsSection />
          </div>
        ) : null}
        {tab === "mypage" ? (
          <DashboardMypageTab user={user} onSignOut={signOutUser} />
        ) : null}
      </main>

      <DashboardBottomNav active={tab} onChange={setTab} />
    </div>
  );
}
