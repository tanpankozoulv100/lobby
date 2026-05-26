import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const CHAT_PREFS = "chatPrefs";

export type ChatPrefFields = {
  /** true = この相手からの DM を通知する */
  dmNotifyEnabled: boolean;
};

export function subscribeChatPref(
  uid: string,
  peerUid: string,
  onData: (pref: ChatPrefFields) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, "users", uid, CHAT_PREFS, peerUid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onData({ dmNotifyEnabled: true });
      return;
    }
    const d = snap.data();
    onData({
      dmNotifyEnabled: d.dmNotifyEnabled !== false,
    });
  });
}

export async function setDmNotifyEnabled(
  uid: string,
  peerUid: string,
  enabled: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  try {
    await setDoc(
      doc(db, "users", uid, CHAT_PREFS, peerUid),
      {
        dmNotifyEnabled: enabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "保存に失敗しました。" };
  }
}
