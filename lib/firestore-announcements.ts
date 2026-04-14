import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { AnnouncementFields } from "@/lib/lobby-firestore-types";

const ANNOUNCEMENTS = "announcements";
const LIST_LIMIT = 20;

export type PublishedAnnouncementRow = { id: string } & AnnouncementFields;

function mapDoc(id: string, data: Record<string, unknown>): PublishedAnnouncementRow | null {
  const title = typeof data.title === "string" ? data.title : "";
  const isPublished = data.isPublished === true;
  if (!title || !isPublished) return null;
  const publishedAt = data.publishedAt;
  if (!(publishedAt instanceof Timestamp)) return null;
  const row: PublishedAnnouncementRow = {
    id,
    title,
    isPublished: true,
    publishedAt,
  };
  if (typeof data.body === "string") row.body = data.body;
  if (data.createdAt instanceof Timestamp) row.createdAt = data.createdAt;
  return row;
}

export function subscribePublishedAnnouncements(
  onData: (rows: PublishedAnnouncementRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(
    collection(db, ANNOUNCEMENTS),
    where("isPublished", "==", true),
    orderBy("publishedAt", "desc"),
    limit(LIST_LIMIT)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: PublishedAnnouncementRow[] = [];
      snap.forEach((d) => {
        const row = mapDoc(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      });
      onData(list);
    },
    (err) => {
      const code = "code" in err ? String((err as { code: string }).code) : "";
      if (code === "failed-precondition") {
        onError?.(
          "お知らせ一覧用のインデックスが未作成です。firestore.indexes.json をデプロイするか、コンソールの案内に従ってください。"
        );
      } else if (code === "permission-denied") {
        onError?.("お知らせの読み取りが拒否されました。セキュリティルールを確認してください。");
      } else {
        onError?.("お知らせの取得に失敗しました。");
      }
    }
  );
}
