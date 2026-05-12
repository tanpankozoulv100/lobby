import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { UserReportReasonCode } from "@/lib/lobby-firestore-types";

const USER_REPORTS = "userReports";
const BLOCKED = "blockedUsers";

export const USER_REPORT_REASON_CODES: UserReportReasonCode[] = [
  "harassment",
  "spam",
  "inappropriate",
  "other",
];

export function subscribeBlockedPeerUids(
  myUid: string,
  onData: (blockedUids: string[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const ref = collection(db, "users", myUid, BLOCKED);
  return onSnapshot(
    ref,
    (snap) => {
      const uids: string[] = [];
      snap.forEach((d) => uids.push(d.id));
      onData(uids.sort());
    },
    (err) => {
      const c = "code" in err ? String((err as { code: string }).code) : "";
      if (c === "permission-denied") {
        onError?.("ブロック一覧の読み取りが拒否されました。");
      } else {
        onError?.("ブロック一覧の取得に失敗しました。");
      }
    }
  );
}

export async function blockPeer(
  myUid: string,
  peerUid: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  if (peerUid === myUid) return { ok: false, message: "自分はブロックできません。" };
  try {
    await setDoc(doc(db, "users", myUid, BLOCKED, peerUid), { createdAt: serverTimestamp() });
    return { ok: true };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "ブロックの保存が拒否されました。" };
    }
    return { ok: false, message: "ブロックに失敗しました。" };
  }
}

export async function unblockPeer(
  myUid: string,
  peerUid: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  try {
    await deleteDoc(doc(db, "users", myUid, BLOCKED, peerUid));
    return { ok: true };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "ブロック解除が拒否されました。" };
    }
    return { ok: false, message: "ブロック解除に失敗しました。" };
  }
}

export async function isPeerBlocked(myUid: string, peerUid: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const snap = await getDoc(doc(db, "users", myUid, BLOCKED, peerUid));
  return snap.exists();
}

export async function submitUserReport(params: {
  reporterUid: string;
  reportedUid: string;
  reasonCode: UserReportReasonCode;
  note?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  if (params.reportedUid === params.reporterUid) {
    return { ok: false, message: "自分を通報することはできません。" };
  }
  if (!USER_REPORT_REASON_CODES.includes(params.reasonCode)) {
    return { ok: false, message: "通報理由が不正です。" };
  }
  const note = (params.note ?? "").trim().slice(0, 500);
  try {
    await addDoc(collection(db, USER_REPORTS), {
      reporterUid: params.reporterUid,
      reportedUid: params.reportedUid,
      reasonCode: params.reasonCode,
      note,
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "通報の送信が拒否されました。" };
    }
    return { ok: false, message: "通報の送信に失敗しました。" };
  }
}
