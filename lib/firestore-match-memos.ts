import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const MATCH_MEMOS = "matchMemos";

export type MatchMemoFields = {
  nickname: string;
  memo: string;
  updatedAt?: unknown;
};

export function subscribeMatchMemo(
  uid: string,
  peerUid: string,
  onData: (data: MatchMemoFields | null) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, "users", uid, MATCH_MEMOS, peerUid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onData(null);
      return;
    }
    const d = snap.data();
    onData({
      nickname: typeof d.nickname === "string" ? d.nickname : "",
      memo: typeof d.memo === "string" ? d.memo : "",
      updatedAt: d.updatedAt,
    });
  });
}

export async function saveMatchMemo(
  uid: string,
  peerUid: string,
  nickname: string,
  memo: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  const nick = nickname.trim();
  const body = memo.trim();
  if (nick.length > 50) return { ok: false, message: "ニックネームは50文字以内にしてください。" };
  if (body.length > 2000) return { ok: false, message: "メモは2000文字以内にしてください。" };
  try {
    await setDoc(
      doc(db, "users", uid, MATCH_MEMOS, peerUid),
      {
        nickname: nick,
        memo: body,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "保存に失敗しました。" };
  }
}
