import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const CHAT_THREADS = "chatThreads";
const MESSAGES = "messages";
const MESSAGE_PAGE = 200;

export type ChatMessageRow = {
  id: string;
  senderUid: string;
  text: string;
  createdAt?: unknown;
};

/** レター1通の最大文字数 */
export const LETTER_MAX_LENGTH = 800;

/**
 * メッセージ一覧から自分／相手の手紙（各1通）を取り出す。
 * 旧データで同一送信者の複数行がある場合は最初の1通を採用する。
 */
export function pickLetters(
  rows: ChatMessageRow[],
  myUid: string,
  peerUid: string
): { mine: ChatMessageRow | null; peer: ChatMessageRow | null } {
  let mine: ChatMessageRow | null = null;
  let peer: ChatMessageRow | null = null;
  for (const r of rows) {
    if (r.senderUid === myUid && !mine) mine = r;
    else if (r.senderUid === peerUid && !peer) peer = r;
  }
  return { mine, peer };
}

/** Firestore Timestamp 等を ms に変換（取得できなければ null） */
export function chatTimestampMs(ts: unknown): number | null {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

/** 参加者 UID を辞書順に並べたスレッド ID（`participantLow_participantHigh`） */
export function chatThreadId(uidA: string, uidB: string): string {
  const [low, high] = [uidA, uidB].sort();
  return `${low}_${high}`;
}

export function parseChatThreadId(threadId: string): { low: string; high: string } | null {
  const i = threadId.indexOf("_");
  if (i <= 0 || i >= threadId.length - 1) return null;
  return { low: threadId.slice(0, i), high: threadId.slice(i + 1) };
}

export async function ensureChatThread(uidA: string, uidB: string): Promise<string | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const [participantLow, participantHigh] = [uidA, uidB].sort();
  const threadId = `${participantLow}_${participantHigh}`;
  const ref = doc(db, CHAT_THREADS, threadId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participantLow,
        participantHigh,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { updatedAt: serverTimestamp() });
    }
    return threadId;
  } catch {
    return null;
  }
}

export function subscribeChatMessages(
  threadId: string,
  onData: (rows: ChatMessageRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(
    collection(db, CHAT_THREADS, threadId, MESSAGES),
    orderBy("createdAt", "asc"),
    limit(MESSAGE_PAGE)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: ChatMessageRow[] = [];
      snap.forEach((d) => {
        const x = d.data();
        rows.push({
          id: d.id,
          senderUid: typeof x.senderUid === "string" ? x.senderUid : "",
          text: typeof x.text === "string" ? x.text : "",
          createdAt: x.createdAt,
        });
      });
      onData(rows);
    },
    (err) => {
      const c = "code" in err ? String((err as { code: string }).code) : "";
      if (c === "failed-precondition") {
        onError?.("レター用のインデックスが未作成です。firestore.indexes.json をデプロイしてください。");
      } else if (c === "permission-denied") {
        onError?.("メッセージの読み取りが拒否されました。");
      } else {
        onError?.("メッセージの取得に失敗しました。");
      }
    }
  );
}

/** 自分がスレッドを読んだ時刻を記録（相手の画面の「既読」表示に使う） */
export async function markChatThreadRead(myUid: string, peerUid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const [low, high] = [myUid, peerUid].sort();
  const threadId = `${low}_${high}`;
  const field = myUid === low ? "lastReadLow" : "lastReadHigh";
  try {
    await updateDoc(doc(db, CHAT_THREADS, threadId), { [field]: serverTimestamp() });
  } catch {
    // スレッド未作成・権限などは既読更新失敗として無視（チャット自体は継続）
  }
}

export type ChatThreadReadState = {
  /** 相手が最後にこのスレッドを読んだ時刻（ms）。未読/未取得は null */
  peerLastReadMs: number | null;
};

/** スレッドの既読時刻を購読し、相手側の最終既読 ms を返す */
export function subscribeChatThreadRead(
  myUid: string,
  peerUid: string,
  onData: (state: ChatThreadReadState) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;
  const [low, high] = [myUid, peerUid].sort();
  const threadId = `${low}_${high}`;
  // 相手の既読フィールド（自分が low なら相手は high 側）
  const peerField = myUid === low ? "lastReadHigh" : "lastReadLow";
  return onSnapshot(
    doc(db, CHAT_THREADS, threadId),
    (snap) => {
      const data = snap.data();
      onData({ peerLastReadMs: chatTimestampMs(data?.[peerField]) });
    },
    () => onData({ peerLastReadMs: null })
  );
}

/**
 * レターを送信する。1マッチにつき各自1通だけ（docId=送信者UIDで重複送信を防ぐ）。
 * すでに自分の手紙がある場合は再送不可。
 */
export async function sendChatMessage(
  myUid: string,
  peerUid: string,
  textRaw: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  const text = textRaw.trim();
  if (!text) return { ok: false, message: "手紙の本文を書いてください。" };
  if (text.length > LETTER_MAX_LENGTH) {
    return { ok: false, message: `手紙は${LETTER_MAX_LENGTH}文字以内にしてください。` };
  }
  if (peerUid === myUid) return { ok: false, message: "自分には送信できません。" };

  const threadId = await ensureChatThread(myUid, peerUid);
  if (!threadId) return { ok: false, message: "レターの準備に失敗しました。" };

  // すでに自分の手紙があれば送信しない（1通制）
  const letterRef = doc(db, CHAT_THREADS, threadId, MESSAGES, myUid);
  try {
    const existing = await getDoc(letterRef);
    if (existing.exists()) {
      return { ok: false, message: "この相手へはすでに手紙を送っています。1マッチにつき1通までです。" };
    }
  } catch {
    // 取得失敗時は書き込み側の create ルールで弾かれるので続行
  }

  try {
    // docId=myUid + create のみ許可。重複は permission-denied で弾かれる
    await setDoc(letterRef, {
      senderUid: myUid,
      text,
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, CHAT_THREADS, threadId),
      { updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { ok: true };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "送信が拒否されました。すでに送信済みか、マッチ相手・期限を確認してください。" };
    }
    return { ok: false, message: "送信に失敗しました。" };
  }
}
