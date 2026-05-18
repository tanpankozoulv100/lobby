import {
  addDoc,
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
        onError?.("チャット用のインデックスが未作成です。firestore.indexes.json をデプロイしてください。");
      } else if (c === "permission-denied") {
        onError?.("メッセージの読み取りが拒否されました。");
      } else {
        onError?.("メッセージの取得に失敗しました。");
      }
    }
  );
}

export async function sendChatMessage(
  myUid: string,
  peerUid: string,
  textRaw: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  const text = textRaw.trim();
  if (!text) return { ok: false, message: "メッセージを入力してください。" };
  if (text.length > 2000) return { ok: false, message: "メッセージは2000文字以内にしてください。" };
  if (peerUid === myUid) return { ok: false, message: "自分には送信できません。" };

  const threadId = await ensureChatThread(myUid, peerUid);
  if (!threadId) return { ok: false, message: "チャットの準備に失敗しました。" };

  try {
    await addDoc(collection(db, CHAT_THREADS, threadId, MESSAGES), {
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
      return { ok: false, message: "送信が拒否されました。マッチ相手か、チャット期限を確認してください。" };
    }
    return { ok: false, message: "送信に失敗しました。" };
  }
}
