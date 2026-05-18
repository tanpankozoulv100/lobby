import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

/** Firestore `admins/{uid}` — ドキュメント ID は Firebase Auth の uid（中身は空で可） */
export const LOBBY_ADMINS_COLLECTION = "admins";

/**
 * 運営スタッフか（本人確認スキップ・`/staff/events`・通報の運営 read 等）。
 * 付与は Firebase Console / Admin SDK のみ（クライアントから create 不可）。
 */
export async function checkIsLobbyStaff(uid: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const snap = await getDoc(doc(db, LOBBY_ADMINS_COLLECTION, uid));
  return snap.exists();
}

export function subscribeIsLobbyStaff(
  uid: string,
  onData: (isStaff: boolean) => void,
  onError?: () => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.();
    return null;
  }
  return onSnapshot(
    doc(db, LOBBY_ADMINS_COLLECTION, uid),
    (snap) => onData(snap.exists()),
    () => onError?.()
  );
}
