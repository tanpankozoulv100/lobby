import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const PARTICIPANT_COUNTER_PATH = ["system", "participantCounter"] as const;
/** 採番の上限（1000人規模想定で余裕を見て 9999） */
const MAX_PARTICIPANT_NO = 9999;

/**
 * ダッシュボード初回開放時に参加者番号を付与する。
 * - 一般ユーザー: 開放順に 001, 002, … 1000, …（`system/participantCounter` で採番）
 * - 運営（admins）: 000 固定
 */
export async function claimParticipantNumberOnLobbyOpen(
  uid: string,
  isLobbyStaff: boolean
): Promise<{ ok: true; participantNo: number } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };

  const userRef = doc(db, "users", uid);
  const counterRef = doc(db, ...PARTICIPANT_COUNTER_PATH);

  try {
    const participantNo = await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("profile_missing");
      }
      const data = userSnap.data();
      if (data.lobbyOpenedAt != null && typeof data.participantNo === "number") {
        return data.participantNo as number;
      }

      /** 旧データ（採番前に付いていた番号）はそのまま開放記録だけ付ける */
      if (!isLobbyStaff && typeof data.participantNo === "number" && data.participantNo >= 1) {
        tx.update(userRef, {
          lobbyOpenedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return data.participantNo as number;
      }

      if (isLobbyStaff) {
        tx.update(userRef, {
          participantNo: 0,
          lobbyOpenedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return 0;
      }

      const counterSnap = await tx.get(counterRef);
      let nextNo = 1;
      if (counterSnap.exists()) {
        const raw = counterSnap.data()?.nextNumber;
        nextNo = typeof raw === "number" && raw >= 1 ? raw : 1;
      }

      if (nextNo > MAX_PARTICIPANT_NO) {
        throw new Error("participant_full");
      }

      tx.update(userRef, {
        participantNo: nextNo,
        lobbyOpenedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (counterSnap.exists()) {
        tx.update(counterRef, { nextNumber: nextNo + 1 });
      } else {
        tx.set(counterRef, { nextNumber: nextNo + 1 });
      }

      return nextNo;
    });

    return { ok: true, participantNo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "profile_missing") {
      return { ok: false, message: "プロフィールがありません。" };
    }
    if (msg === "participant_full") {
      return { ok: false, message: "参加者番号の上限に達しました。" };
    }
    return { ok: false, message: "参加者番号の付与に失敗しました。" };
  }
}
