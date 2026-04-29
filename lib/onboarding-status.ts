import type { UserProfileFields } from "@/lib/lobby-firestore-types";

/** next.config + .env の値（ビルド時にインライン） */
function parseDevBypassRaw(): boolean {
  const raw = (process.env.NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * ローカル開発用: 本人確認・チケットなしでダッシュボードへ入れる。
 * `NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING` を `next.config` の `env` と .env からバンドルに載せる。
 * 本番ホスティングではこの変数を **設定しない** こと（誤設定するとスキップが有効になる）。
 */
export function isDevOnboardingBypassEnabled(): boolean {
  return parseDevBypassRaw();
}

/** ダッシュボード利用可否（本人確認承認済みかつチケット引き換え済み） */
export function isLobbyAccessGranted(profile: UserProfileFields | null | undefined): boolean {
  if (isDevOnboardingBypassEnabled()) return true;
  if (!profile) return false;
  if (profile.identityStatus !== "approved") return false;
  if (profile.ticketRedeemedAt == null) return false;
  return true;
}
