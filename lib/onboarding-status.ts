import type { UserProfileFields } from "@/lib/lobby-firestore-types";

export type OnboardingBypassContext = {
  /** Firestore `admins/{uid}` が存在する（本番でも利用可・推奨） */
  isLobbyStaff?: boolean;
};

/** next.config + .env の値（ビルド時にインライン） */
function parseDevBypassRaw(): boolean {
  const raw = (process.env.NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** 一時運用用: 本番でもオンボーディングをスキップできる（全員対象・非推奨） */
function parseGlobalBypassRaw(): boolean {
  const raw = (process.env.NEXT_PUBLIC_LOBBY_BYPASS_ONBOARDING ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function parseOnboardingBypassUidAllowlist(): ReadonlySet<string> {
  const raw = (process.env.NEXT_PUBLIC_LOBBY_ONBOARDING_BYPASS_UIDS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

const onboardingBypassUidAllowlist = parseOnboardingBypassUidAllowlist();

/** 許可リストが空のときだけ「全員バイパス」環境変数を有効にする */
function isGlobalEveryoneOnboardingBypassEnabled(): boolean {
  if (onboardingBypassUidAllowlist.size > 0) return false;
  return parseDevBypassRaw() || parseGlobalBypassRaw();
}

function isEnvUidOnboardingBypass(uid: string | null | undefined): boolean {
  if (onboardingBypassUidAllowlist.size > 0) {
    return !!uid && onboardingBypassUidAllowlist.has(uid);
  }
  return isGlobalEveryoneOnboardingBypassEnabled();
}

/**
 * 本人確認・チケットをスキップしてダッシュボード相当のゲートを通すか。
 * - **`admins/{uid}`（運営）**: Firestore で付与。本番推奨。ログインだけで判定（書類不要）。
 * - **`NEXT_PUBLIC_LOBBY_ONBOARDING_BYPASS_UIDS`**: 開発用の UID 列挙（クライアントに載るため本番非推奨）。
 * - **`NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING`**: ローカル全員スキップ（UID リストが空のときのみ）。
 */
export function isOnboardingBypassActiveForUser(
  uid: string | null | undefined,
  ctx?: OnboardingBypassContext
): boolean {
  if (ctx?.isLobbyStaff) return true;
  return isEnvUidOnboardingBypass(uid);
}

/** 帯表示用 */
export function shouldShowOnboardingDevBypassBanner(
  uid: string | null | undefined,
  authLoading: boolean,
  ctx?: OnboardingBypassContext
): boolean {
  if (authLoading) return false;
  if (ctx?.isLobbyStaff) return false;
  if (onboardingBypassUidAllowlist.size > 0) {
    return !!uid && onboardingBypassUidAllowlist.has(uid);
  }
  return isGlobalEveryoneOnboardingBypassEnabled();
}

/** ダッシュボード利用可否（本人確認承認済みかつチケット引き換え済み） */
export function isLobbyAccessGranted(
  profile: UserProfileFields | null | undefined,
  uid?: string | null,
  ctx?: OnboardingBypassContext
): boolean {
  if (isOnboardingBypassActiveForUser(uid, ctx)) return true;
  if (!profile) return false;
  if (profile.identityStatus !== "approved") return false;
  if (profile.ticketRedeemedAt == null) return false;
  return true;
}

/** Cloud Functions 等によりアカウント停止中 */
export function isAccountSuspended(profile: UserProfileFields | null | undefined): boolean {
  return profile?.accountStatus === "suspended";
}

/** ダッシュボード本体（ホーム以降）に入れるか */
export function canUseLobbyDashboard(
  profile: UserProfileFields | null | undefined,
  uid?: string | null,
  ctx?: OnboardingBypassContext
): boolean {
  if (isOnboardingBypassActiveForUser(uid, ctx)) return true;
  if (isAccountSuspended(profile)) return false;
  return isLobbyAccessGranted(profile, uid, ctx);
}
