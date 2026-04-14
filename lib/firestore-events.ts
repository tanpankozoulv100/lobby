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
import type { EventFields } from "@/lib/lobby-firestore-types";

const EVENTS = "events";
const LIST_LIMIT = 30;

export type PublishedEventRow = { id: string } & EventFields;

function mapDoc(id: string, data: Record<string, unknown>): PublishedEventRow | null {
  const title = typeof data.title === "string" ? data.title : "";
  const isPublished = data.isPublished === true;
  if (!title || !isPublished) return null;
  const startsAt = data.startsAt;
  if (!(startsAt instanceof Timestamp)) return null;
  const row: PublishedEventRow = {
    id,
    title,
    isPublished: true,
    startsAt,
  };
  if (typeof data.description === "string") row.description = data.description;
  if (data.endsAt instanceof Timestamp) row.endsAt = data.endsAt;
  if (typeof data.locationSummary === "string") row.locationSummary = data.locationSummary;
  if (data.createdAt instanceof Timestamp) row.createdAt = data.createdAt;
  return row;
}

export function subscribePublishedEvents(
  onData: (events: PublishedEventRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(
    collection(db, EVENTS),
    where("isPublished", "==", true),
    orderBy("startsAt", "desc"),
    limit(LIST_LIMIT)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: PublishedEventRow[] = [];
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
          "イベント一覧用のインデックスが未作成です。コンソールのリンクから作成するか、firestore.indexes.json をデプロイしてください。"
        );
      } else if (code === "permission-denied") {
        onError?.("イベントの読み取りが拒否されました。セキュリティルールを確認してください。");
      } else {
        onError?.("イベント一覧の取得に失敗しました。");
      }
    }
  );
}
