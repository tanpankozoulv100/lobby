"use client";

import { useAuth } from "@/components/auth-provider";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import { shouldShowOnboardingDevBypassBanner } from "@/lib/onboarding-status";

/** 全ページ先頭。開発・テスト用オンボーディングバイパス時のみ表示（運営スタッフは非表示） */
export function DevBypassBanner() {
  const { user, loading } = useAuth();
  const { isStaff, staffGateReady } = useLobbyStaff(user?.uid ?? null);
  const ctx = { isLobbyStaff: isStaff };

  if (!staffGateReady || !shouldShowOnboardingDevBypassBanner(user?.uid ?? null, loading, ctx)) {
    return null;
  }

  const uidListActive = (process.env.NEXT_PUBLIC_LOBBY_ONBOARDING_BYPASS_UIDS ?? "").trim().length > 0;

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950"
    >
      {uidListActive ? (
        <>
          テスト用: 許可 UID のみ本人確認・チケットをスキップ（
          <code className="rounded bg-amber-100/80 px-0.5">NEXT_PUBLIC_LOBBY_ONBOARDING_BYPASS_UIDS</code>
          ）
        </>
      ) : (
        <>
          開発モード: 本人確認・チケットなしで進めます（
          <code className="rounded bg-amber-100/80 px-0.5">NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING</code>）
        </>
      )}
    </div>
  );
}
