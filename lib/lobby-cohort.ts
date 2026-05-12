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

/**
 * 通報ペアのコホート分離: `cohortFlipActive` が true のとき、ハッシュベースの A/B を反転して表示する。
 * （Firestore の `users/{uid}.cohortFlipActive` は Cloud Functions のみが書き込む）
 */
export function getEffectiveLobbyCohortForSeason(
  uid: string,
  cohortFlipActive?: boolean,
  seasonKey: string = LOBBY_COHORT_SEASON_KEY
): LobbyCohort {
  const base = getLobbyCohortForSeason(uid, seasonKey);
  if (!cohortFlipActive) return base;
  return base === "A" ? "B" : "A";
}
