"use client";

import { LobbyPageShell } from "@/components/lobby-page-shell";
import { useAuth } from "@/components/auth-provider";
import { OnboardingClient } from "@/components/onboarding-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <LobbyPageShell>
        <p className="text-center text-sm text-zinc-500">読み込み中…</p>
      </LobbyPageShell>
    );
  }

  return (
    <LobbyPageShell>
      <OnboardingClient user={user} />
    </LobbyPageShell>
  );
}
