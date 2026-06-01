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
import { normalizeEncounterCount } from "@/lib/match-encounter";
import { getFirebaseDb } from "@/lib/firebase";
import { ensureChatThread } from "@/lib/firestore-chat";
import {
  getRematchCooldownMessage,
  latestMatchInstantFromLinkFields,
} from "@/lib/match-chat-window";
import { fetchUserSeasonEndDate } from "@/lib/firestore-seasons";
import { mergeLinkTimestamps, type MatchLinkTimestamps } from "@/lib/match-link-times";

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

export type OutboundLinkRow = { peerUid: string; encounterCount: number } & MatchLinkTimestamps;

export type MergedMatchRow = { peerUid: string; encounterCount: number } & MatchLinkTimestamps;

/** outbound（自分がスキャン）と linkedFrom（相手がスキャン）をマージしたマッチ一覧 */
export function mergeMatchLinks(
  outbound: OutboundLinkRow[],
  inbound: InboundLinkRow[]
): MergedMatchRow[] {
  const byPeer = new Map<string, MatchLinkTimestamps & { encounterCount: number }>();
  const upsert = (peerUid: string, fields: MatchLinkTimestamps, encounterCount: number) => {
    const prev = byPeer.get(peerUid);
    const merged = mergeLinkTimestamps(prev, fields);
    const count = Math.max(prev?.encounterCount ?? 1, encounterCount);
    byPeer.set(peerUid, { ...merged, encounterCount: count });
  };
  for (const r of outbound) {
    upsert(r.peerUid, { createdAt: r.createdAt, lastMatchedAt: r.lastMatchedAt }, r.encounterCount);
  }
  for (const r of inbound) {
    upsert(
      r.sourceUid,
      { createdAt: r.createdAt, lastMatchedAt: r.lastMatchedAt },
      normalizeEncounterCount(r.encounterCount)
    );
  }
  return [...byPeer.entries()].map(([peerUid, fields]) => ({ peerUid, ...fields }));
}

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
        const data = d.data();
        rows.push({
          peerUid: d.id,
          createdAt: data.createdAt,
          lastMatchedAt: data.lastMatchedAt,
          encounterCount: normalizeEncounterCount(data.encounterCount),
        });
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

export type InboundLinkRow = { sourceUid: string; encounterCount?: number } & MatchLinkTimestamps;

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
        const data = d.data();
        rows.push({
          sourceUid: d.id,
          createdAt: data.createdAt,
          lastMatchedAt: data.lastMatchedAt,
          encounterCount: data.encounterCount,
        });
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
): Promise<{ ok: true; rematched?: boolean } | { ok: false; message: string }> {
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
  const inboundOnPeerRef = doc(db, "users", peerUid, LINKED_FROM, myUid);
  const inboundOnMeRef = doc(db, "users", myUid, LINKED_FROM, peerUid);

  const [outboundSnap, inboundOnPeerSnap, inboundOnMeSnap] = await Promise.all([
    getDoc(linkRef),
    getDoc(inboundOnPeerRef),
    getDoc(inboundOnMeRef),
  ]);

  const rematchedAt = serverTimestamp();
  const alreadyLinked =
    outboundSnap.exists() || inboundOnPeerSnap.exists() || inboundOnMeSnap.exists();

  const commitRematchBatch = async () => {
    const batch = writeBatch(db);
    if (outboundSnap.exists()) {
      const prevCount = normalizeEncounterCount(outboundSnap.data()?.encounterCount);
      batch.update(linkRef, {
        lastMatchedAt: rematchedAt,
        encounterCount: prevCount + 1,
      });
    } else {
      batch.set(linkRef, { createdAt: rematchedAt, encounterCount: 1 });
    }
    if (inboundOnPeerSnap.exists()) {
      batch.update(inboundOnPeerRef, { lastMatchedAt: rematchedAt });
    } else {
      batch.set(inboundOnPeerRef, { createdAt: rematchedAt });
    }
    await batch.commit();
    await ensureChatThread(myUid, peerUid);
  };

  if (alreadyLinked) {
    const lastMatchAt = latestMatchInstantFromLinkFields(
      outboundSnap.exists() ? (outboundSnap.data() as MatchLinkTimestamps) : undefined,
      inboundOnMeSnap.exists() ? (inboundOnMeSnap.data() as MatchLinkTimestamps) : undefined,
      inboundOnPeerSnap.exists() ? (inboundOnPeerSnap.data() as MatchLinkTimestamps) : undefined
    );
    if (lastMatchAt) {
      const seasonEndAt = (await fetchUserSeasonEndDate(myUid)) ?? undefined;
      const cooldownMessage = getRematchCooldownMessage(lastMatchAt, new Date(), seasonEndAt);
      if (cooldownMessage) {
        return { ok: false, message: cooldownMessage };
      }
    }

    try {
      await commitRematchBatch();
      return { ok: true, rematched: true };
    } catch (err: unknown) {
      const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (c === "permission-denied") {
        return {
          ok: false,
          message:
            "再マッチの保存が拒否されました。`npm run deploy:rules` で Firestore ルールを反映してください。",
        };
      }
      return { ok: false, message: "再マッチの保存に失敗しました。しばらくしてからお試しください。" };
    }
  }

  try {
    const batch = writeBatch(db);
    batch.set(linkRef, { createdAt: serverTimestamp(), encounterCount: 1 });
    batch.set(inboundOnPeerRef, { createdAt: serverTimestamp() });
    await batch.commit();
    await ensureChatThread(myUid, peerUid);
    return { ok: true, rematched: false };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "保存が拒否されました。セキュリティルールを確認してください。" };
    }
    return { ok: false, message: "連携の保存に失敗しました。" };
  }
}
