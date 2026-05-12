/**
 * アプリの `lib/season-config.ts` の `LOBBY_COHORT_SEASON_KEY` と一致させること。
 */
export const LOBBY_COHORT_SEASON_KEY = "nagoya-s1-2026";

export type LobbyCohort = "A" | "B";

export function getLobbyCohortForSeason(uid: string, seasonKey: string = LOBBY_COHORT_SEASON_KEY): LobbyCohort {
  let h = 0;
  const s = `${seasonKey}:${uid}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? "A" : "B";
}
