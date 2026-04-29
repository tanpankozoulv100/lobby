import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { EventDisplayWindowFields } from "@/lib/lobby-firestore-types";

const EVENT_DISPLAY_WINDOW = "eventDisplayWindow";

export type EventDisplayWindowRow = EventDisplayWindowFields;

function mapRow(data: Record<string, unknown>): EventDisplayWindowRow | null {
  const weekKey = typeof data.weekKey === "string" ? data.weekKey : "";
  const visibleFromDateKey = typeof data.visibleFromDateKey === "string" ? data.visibleFromDateKey : "";
  const visibleToDateKey = typeof data.visibleToDateKey === "string" ? data.visibleToDateKey : "";
  if (!weekKey || !/^\d{8}$/.test(visibleFromDateKey) || !/^\d{8}$/.test(visibleToDateKey)) return null;
  return {
    weekKey,
    visibleFromDateKey,
    visibleToDateKey,
    updatedAt: data.updatedAt as EventDisplayWindowRow["updatedAt"],
  };
}

export function subscribeEventDisplayWindow(
  onData: (row: EventDisplayWindowRow | null) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const ref = doc(db, EVENT_DISPLAY_WINDOW, "current");
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapRow(snap.data() as Record<string, unknown>));
    },
    () => onError?.("公開期間の取得に失敗しました。")
  );
}
