import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const CONNECTION_CODES = "connectionCodes";
const OUTBOUND = "outboundLinks";
const LINKED_FROM = "linkedFrom";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(length: number): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CODE_ALPHABET[arr[i]! % CODE_ALPHABET.length];
  }
  return s;
}

function normalizeCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** QR 文字列や貼り付けから 6 文字の連携コードを取り出す */
export function extractPeerCodeFromQrOrInput(raw: string): string | null {
  const t = raw.trim();
  const onlyAz09 = normalizeCodeInput(t);
  if (onlyAz09.length === 6) return onlyAz09;
  const m = t.match(/LOBBY\s*:\s*([A-Za-z0-9]{6})/);
  if (m) return normalizeCodeInput(m[1]!);
  try {
    const j = JSON.parse(t) as unknown;
    if (j && typeof j === "object" && "c" in j && typeof (j as { c: unknown }).c === "string") {
      const c = normalizeCodeInput((j as { c: string }).c);
      if (c.length === 6) return c;
    }
  } catch {
    /* not json */
  }
  return null;
}

/** 自分の connectionCodes ドキュメント（ID＝コード）を確保 */
export async function ensureMyConnectionCode(uid: string): Promise<string | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const existingQ = query(
    collection(db, CONNECTION_CODES),
    where("ownerUid", "==", uid),
    limit(1)
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) {
    return existing.docs[0]!.id;
  }
  for (let i = 0; i < 24; i++) {
    const code = randomCode(6);
    const ref = doc(db, CONNECTION_CODES, code);
    try {
      await runTransaction(db, async (t) => {
        const s = await t.get(ref);
        if (s.exists()) {
          throw new Error("taken");
        }
        t.set(ref, { ownerUid: uid });
      });
      return code;
    } catch {
      continue;
    }
  }
  return null;
}

export function subscribeMyConnectionCode(
  uid: string,
  onCode: (code: string | null) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(collection(db, CONNECTION_CODES), where("ownerUid", "==", uid), limit(1));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onCode(null);
        return;
      }
      onCode(snap.docs[0]!.id);
    },
    (err) => {
      const c = "code" in err ? String((err as { code: string }).code) : "";
      if (c === "permission-denied") {
        onError?.("連携コードの読み取りが拒否されました。ルールをデプロイしてください。");
      } else if (c === "failed-precondition") {
        onError?.("連携コード用のインデックスが必要です。コンソールの案内に従ってください。");
      } else {
        onError?.("連携コードの取得に失敗しました。");
      }
    }
  );
}

export type OutboundLinkRow = { peerUid: string; createdAt?: unknown };

export function subscribeOutboundLinks(
  uid: string,
  onData: (rows: OutboundLinkRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const ref = collection(db, "users", uid, OUTBOUND);
  return onSnapshot(
    ref,
    (snap) => {
      const rows: OutboundLinkRow[] = [];
      snap.forEach((d) => {
        rows.push({ peerUid: d.id, createdAt: d.data().createdAt });
      });
      onData(rows);
    },
    (err) => {
      const c = "code" in err ? String((err as { code: string }).code) : "";
      if (c === "permission-denied") {
        onError?.("連携一覧の読み取りが拒否されました。");
      } else {
        onError?.("連携一覧の取得に失敗しました。");
      }
    }
  );
}

export type InboundLinkRow = { sourceUid: string; createdAt?: unknown };

export function subscribeInboundLinks(
  uid: string,
  onData: (rows: InboundLinkRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const ref = collection(db, "users", uid, LINKED_FROM);
  return onSnapshot(
    ref,
    (snap) => {
      const rows: InboundLinkRow[] = [];
      snap.forEach((d) => {
        rows.push({ sourceUid: d.id, createdAt: d.data().createdAt });
      });
      onData(rows);
    },
    (err) => {
      const c = "code" in err ? String((err as { code: string }).code) : "";
      if (c === "permission-denied") {
        onError?.("「あなたから見た連携」の読み取りが拒否されました。");
      } else {
        onError?.("連携情報の取得に失敗しました。");
      }
    }
  );
}

export async function registerLinkByPeerCode(
  myUid: string,
  peerCodeRaw: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  const normalized =
    extractPeerCodeFromQrOrInput(peerCodeRaw) ?? normalizeCodeInput(peerCodeRaw);
  if (normalized.length !== 6) {
    return {
      ok: false,
      message:
        "連携コードが読み取れません。6文字のコード、または QR の内容（LOBBY:XXXXXX）を入力してください。",
    };
  }
  const codeRef = doc(db, CONNECTION_CODES, normalized);
  let peerUid: string;
  try {
    const snap = await getDoc(codeRef);
    if (!snap.exists()) {
      return { ok: false, message: "そのコードのユーザーが見つかりません。" };
    }
    const d = snap.data();
    if (typeof d.ownerUid !== "string") {
      return { ok: false, message: "データが不正です。" };
    }
    peerUid = d.ownerUid;
  } catch {
    return { ok: false, message: "コードの確認に失敗しました。" };
  }
  if (peerUid === myUid) {
    return { ok: false, message: "自分のコードは入力できません。" };
  }
  const linkRef = doc(db, "users", myUid, OUTBOUND, peerUid);
  const existing = await getDoc(linkRef);
  if (existing.exists()) {
    return { ok: false, message: "すでにこの相手と連携済みです。" };
  }
  const inboundRef = doc(db, "users", peerUid, LINKED_FROM, myUid);
  try {
    const batch = writeBatch(db);
    batch.set(linkRef, { createdAt: serverTimestamp() });
    batch.set(inboundRef, { createdAt: serverTimestamp() });
    await batch.commit();
    return { ok: true };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "保存が拒否されました。セキュリティルールを確認してください。" };
    }
    return { ok: false, message: "連携の保存に失敗しました。" };
  }
}
