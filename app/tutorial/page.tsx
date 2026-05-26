"use client";

import { LobbyPageShell } from "@/components/lobby-page-shell";
import { CompatibilityTutorialClient } from "@/components/compatibility-tutorial-client";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function TutorialPage() {
  const { user, loading } = useRequireAuth();

  if (loading || !user) {
    return (
      <LobbyPageShell>
        <p className="text-center text-sm text-zinc-500">読み込み中…</p>
      </LobbyPageShell>
    );
  }

  return (
    <LobbyPageShell>
      <CompatibilityTutorialClient user={user} />
    </LobbyPageShell>
  );
}
