import { doc, type Firestore, type Transaction } from "firebase/firestore";

export const MAX_SEASON_PARTICIPANT_NO = 9999;

/** `system/seasonParticipantCounters/{seasonId}` — シーズンごとの No. 採番 */
export function seasonParticipantCounterRef(db: Firestore, seasonId: string) {
  return doc(db, "system", "seasonParticipantCounters", seasonId);
}

/** チケット引き換えトランザクション内で呼ぶ（シリアル入力順に 1 から採番） */
export async function assignSeasonParticipantNoInTransaction(
  tx: Transaction,
  db: Firestore,
  seasonId: string
): Promise<number> {
  const counterRef = seasonParticipantCounterRef(db, seasonId);
  const counterSnap = await tx.get(counterRef);
  let nextNo = 1;
  if (counterSnap.exists()) {
    const raw = counterSnap.data()?.nextNumber;
    nextNo = typeof raw === "number" && raw >= 1 ? raw : 1;
  }
  if (nextNo > MAX_SEASON_PARTICIPANT_NO) {
    throw new Error("participant_full");
  }
  if (counterSnap.exists()) {
    tx.update(counterRef, { nextNumber: nextNo + 1 });
  } else {
    tx.set(counterRef, { nextNumber: nextNo + 1 });
  }
  return nextNo;
}
