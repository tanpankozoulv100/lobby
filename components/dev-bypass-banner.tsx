"use client";

import { isDevOnboardingBypassEnabled } from "@/lib/onboarding-status";

/** 全ページ先頭。開発バイパスが有効なときだけ表示 */
export function DevBypassBanner() {
  if (!isDevOnboardingBypassEnabled()) return null;
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950"
    >
      開発モード: 本人確認・チケットなしで進めます（NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING）
    </div>
  );
}
