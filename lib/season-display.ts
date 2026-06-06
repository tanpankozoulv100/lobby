import type { SeasonFields } from "@/lib/lobby-firestore-types";
import {
  LOBBY_COHORT_SEASON_KEY,
  LOBBY_SEASON_UI,
  getSeasonEndDate,
  getSeasonRemainingDays,
} from "@/lib/season-config";

/** シーズン未解決（=未登録）時のフォールバック表示に付与する ID */
export const SEASON_FALLBACK_ID = "__fallback__";

/** UI 向けに正規化したシーズン表示 */
export type SeasonDisplay = {
  id: string;
  headerTitle: string;
  cardTitle: string;
  dateRangeLabel: string;
  participatingCountLabel: string;
  cohortSeasonKey: string;
  locationLabel: string;
  startAt: Date;
  endAt: Date;
};

export function formatParticipatingCountLabel(count: number): string {
  return `このシーズンには${count}人が参加しています`;
}

export function seasonFieldsToDisplay(id: string, fields: SeasonFields): SeasonDisplay {
  const endAt = timestampToDate(fields.endAt) ?? getSeasonEndDate();
  const startAt = timestampToDate(fields.startAt) ?? endAt;
  return {
    id,
    headerTitle: fields.headerTitle.trim() || fields.cardTitle.trim(),
    cardTitle: fields.cardTitle.trim(),
    dateRangeLabel: fields.dateRangeLabel.trim(),
    participatingCountLabel: formatParticipatingCountLabel(fields.redeemedCount ?? 0),
    cohortSeasonKey: fields.cohortSeasonKey.trim(),
    locationLabel: fields.locationLabel.trim(),
    startAt,
    endAt,
  };
}

export function fallbackSeasonDisplay(): SeasonDisplay {
  const endAt = getSeasonEndDate();
  return {
    id: SEASON_FALLBACK_ID,
    headerTitle: LOBBY_SEASON_UI.headerTitle,
    cardTitle: LOBBY_SEASON_UI.cardTitle,
    dateRangeLabel: LOBBY_SEASON_UI.dateRangeLabel,
    participatingCountLabel: LOBBY_SEASON_UI.participatingCountLabel,
    cohortSeasonKey: LOBBY_COHORT_SEASON_KEY,
    locationLabel: "名古屋",
    startAt: new Date(endAt.getTime() - 30 * 24 * 60 * 60 * 1000),
    endAt,
  };
}

export function getSeasonRemainingDaysForDisplay(season: SeasonDisplay, now = new Date()): number {
  const diff = season.endAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/** @deprecated シーズン未解決時のフォールバック */
export function getSeasonRemainingDaysLegacy(now = new Date()): number {
  return getSeasonRemainingDays(now);
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return null;
}
