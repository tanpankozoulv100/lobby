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

/** 開発時は常に。`NEXT_PUBLIC_LOBBY_DEBUG=1` で本番ビルドでも一時的に有効化 */
function shouldLogEventsDebug(): boolean {
  return (
    process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_LOBBY_DEBUG === "1"
  );
}

export type PublishedEventRow = { id: string } & EventFields;

/** Console や取り込みで型がずれても startsAt を Timestamp に寄せる */
function coerceStartsAt(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return Timestamp.fromMillis(value);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") {
    const o = value as { seconds?: unknown; nanoseconds?: unknown; _seconds?: unknown; _nanoseconds?: unknown };
    const sec = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : null;
    const nanoRaw = typeof o.nanoseconds === "number" ? o.nanoseconds : o._nanoseconds;
    const nano = typeof nanoRaw === "number" ? nanoRaw : 0;
    if (sec !== null && Number.isFinite(sec)) {
      try {
        return new Timestamp(sec, nano);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function mapDoc(id: string, data: Record<string, unknown>): PublishedEventRow | null {
  const titleRaw = typeof data.title === "string" ? data.title : "";
  const title = titleRaw.trim();
  const isPublished = data.isPublished === true;
  if (!title || !isPublished) return null;
  const startsAt = coerceStartsAt(data.startsAt);
  if (!startsAt) return null;
  const row: PublishedEventRow = {
    id,
    title,
    isPublished: true,
    startsAt,
  };
  if (typeof data.description === "string") row.description = data.description;
  const endsAt = coerceStartsAt(data.endsAt);
  if (endsAt) row.endsAt = endsAt;
  if (typeof data.locationSummary === "string") row.locationSummary = data.locationSummary;
  const createdAt = coerceStartsAt(data.createdAt);
  if (createdAt) row.createdAt = createdAt;
  return row;
}

export type PublishedEventsSnapshotMeta = {
  /** Firestore クエリが返したドキュメント数（0 なら型・index・プロジェクト不整合） */
  queryDocCount: number;
};

export function subscribePublishedEvents(
  onData: (events: PublishedEventRow[], meta?: PublishedEventsSnapshotMeta) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    if (shouldLogEventsDebug()) {
      console.warn(
        "[lobby:events] DB 未初期化。クライアントの .env（NEXT_PUBLIC_FIREBASE_*）を確認。SSR のこのファイル単体では DB は使えません。"
      );
    }
    onError?.("unavailable");
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
      if (shouldLogEventsDebug()) {
        // console.info は「Default levels」で Info をオフにすると非表示になるため warn を使う
        console.warn("[lobby:events] 一覧の内訳", {
          クエリで返った件数: snap.size,
          アプリで使う件数: list.length,
        });
        if (snap.size > list.length) {
          console.warn(
            `[lobby:events] ${snap.size} 件中 ${list.length} 件のみ有効。除外は title / isPublished（厳密に boolean true）/ startsAt（timestamp 等）を確認。`
          );
        }
        if (snap.size === 0) {
          console.warn(
            "[lobby:events] クエリ結果 0 件。よくある原因: (1) isPublished が真偽値 true ではない (2) ルートの events ではない (3) 別プロジェクトの .env (4) インデックス未作成なら下の onSnapshot error を確認"
          );
        }
      }
      onData(list, { queryDocCount: snap.size });
    },
    (err) => {
      const code = "code" in err ? String((err as { code: string }).code) : "";
      if (shouldLogEventsDebug()) {
        console.error("[lobby:events] onSnapshot error", code, err);
      }
      onError?.(code || "unknown");
    }
  );
}
