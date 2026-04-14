import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const BOARD = "boardPosts";
const PAGE_SIZE = 40;

export type BoardPostRow = {
  id: string;
  authorUid: string;
  authorDisplayName: string;
  body: string;
  createdAt?: unknown;
};

export function subscribeBoardPosts(
  onData: (rows: BoardPostRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(collection(db, BOARD), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
  return onSnapshot(
    q,
    (snap) => {
      const rows: BoardPostRow[] = [];
      snap.forEach((d) => {
        const x = d.data();
        rows.push({
          id: d.id,
          authorUid: typeof x.authorUid === "string" ? x.authorUid : "",
          authorDisplayName:
            typeof x.authorDisplayName === "string" ? x.authorDisplayName : "参加者",
          body: typeof x.body === "string" ? x.body : "",
          createdAt: x.createdAt,
        });
      });
      onData(rows);
    },
    (err) => {
      const c = "code" in err ? String((err as { code: string }).code) : "";
      if (c === "failed-precondition") {
        onError?.("掲示板用のインデックスが未作成です。firestore.indexes.json をデプロイしてください。");
      } else if (c === "permission-denied") {
        onError?.("掲示板の読み取りが拒否されました。");
      } else {
        onError?.("掲示板の取得に失敗しました。");
      }
    }
  );
}

export async function createBoardPost(
  uid: string,
  authorDisplayName: string,
  body: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  const name = authorDisplayName.trim() || "参加者";
  const text = body.trim();
  if (!text) {
    return { ok: false, message: "本文を入力してください。" };
  }
  if (text.length > 500) {
    return { ok: false, message: "本文は500文字以内にしてください。" };
  }
  try {
    await addDoc(collection(db, BOARD), {
      authorUid: uid,
      authorDisplayName: name,
      body: text,
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: unknown) {
    const c = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (c === "permission-denied") {
      return { ok: false, message: "投稿が拒否されました。ルールを確認してください。" };
    }
    return { ok: false, message: "投稿に失敗しました。" };
  }
}
