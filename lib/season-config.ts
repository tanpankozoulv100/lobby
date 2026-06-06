/**
 * ホーム／QRモーダル用のシーズン表示（運営は後から Firestore 等へ移行可）
 * 正本: Obsidian …/アプリ開発/初期UIベース/Lobby 初期UI.pdf（齟齬があれば PDF を優先）
 */
/** グループ A/B 振り分けのハッシュ用（シーズンが変わったら更新） */
export const LOBBY_COHORT_SEASON_KEY = "nagoya-s1-2026";

export const LOBBY_SEASON_UI = {
  // シーズン未解決（=未登録）時のフォールバック表示
  headerTitle: "シーズン未登録",
  cardTitle: "シーズン未登録",
  dateRangeLabel: "",
  /** 履歴画面の参加人数表示（フォールバック。正本は seasons.redeemedCount） */
  participatingCountLabel: "このシーズンには0人が参加しています",
} as const;

/** カウントダウン用: シーズン終了（JST 2026-05-18 23:59:59） */
export function getSeasonEndDate(): Date {
  return new Date(2026, 4, 18, 23, 59, 59);
}

/** 残り日数（0 未満は 0） */
export function getSeasonRemainingDays(now: Date = new Date()): number {
  const end = getSeasonEndDate();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function formatCountdownBanner(days: number): string {
  return `シーズン終了まで残り ${days}日`;
}
