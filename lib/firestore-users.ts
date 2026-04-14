import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";

const USERS = "users";

function hashUidToParticipantNo(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return (h % 999) + 1;
}

function generateParticipantSerial(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const r = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `@${y}${m}${day}-${r}`;
}

export async function ensureUserProfile(
  uid: string,
  email: string | null | undefined
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  const fallbackName = email?.split("@")[0]?.trim() || `ユーザー${uid.slice(0, 6)}`;
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: fallbackName,
      bio: "",
      participantNo: hashUidToParticipantNo(uid),
      participantSerial: generateParticipantSerial(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const d = snap.data();
  if (typeof d.participantNo !== "number" || typeof d.participantSerial !== "string") {
    await updateDoc(ref, {
      participantNo: hashUidToParticipantNo(uid),
      participantSerial: generateParticipantSerial(),
      updatedAt: serverTimestamp(),
    });
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (data: UserProfileFields | null) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。設定を確認してください。");
    return null;
  }
  const ref = doc(db, USERS, uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        displayName: typeof d.displayName === "string" ? d.displayName : "",
        bio: typeof d.bio === "string" ? d.bio : "",
        participantNo: typeof d.participantNo === "number" ? d.participantNo : undefined,
        participantSerial: typeof d.participantSerial === "string" ? d.participantSerial : undefined,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      });
    },
    (err) => {
      const code = "code" in err ? String((err as { code: string }).code) : "";
      if (code === "permission-denied") {
        onError?.("プロフィールの読み取りが拒否されました。セキュリティルールを確認してください。");
      } else {
        onError?.("プロフィールの読み込みに失敗しました。");
      }
    }
  );
}

export async function updateUserProfile(
  uid: string,
  displayName: string,
  bio: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { ok: false, message: "Firestore に接続できません。" };
  }
  const name = displayName.trim();
  const bioTrim = bio.trim();
  if (!name) {
    return { ok: false, message: "表示名を入力してください。" };
  }
  if (name.length > 50) {
    return { ok: false, message: "表示名は50文字以内にしてください。" };
  }
  if (bioTrim.length > 500) {
    return { ok: false, message: "自己紹介は500文字以内にしてください。" };
  }
  const ref = doc(db, USERS, uid);
  try {
    await updateDoc(ref, {
      displayName: name,
      bio: bioTrim,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied") {
      return { ok: false, message: "保存が拒否されました。セキュリティルールを確認してください。" };
    }
    if (code === "not-found") {
      return { ok: false, message: "プロフィールがまだありません。ページを再読み込みしてください。" };
    }
    return { ok: false, message: "保存に失敗しました。" };
  }
}
