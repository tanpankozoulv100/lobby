import { LOBBY_COHORT_SEASON_KEY } from "@/lib/season-config";
import type { LobbyCohort } from "@/lib/lobby-firestore-types";

/**
 * UID とシーズンキーから A/B を決定（ユーザーが選べず、同一シーズンでは不変）。
 * 完全な無作為ではないが、改ざんしにくい。
 */
export function getLobbyCohortForSeason(uid: string, seasonKey: string = LOBBY_COHORT_SEASON_KEY): LobbyCohort {
  let h = 0;
  const s = `${seasonKey}:${uid}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? "A" : "B";
}
