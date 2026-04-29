import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { EventSlotChoiceFields, EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";

const SLOT_CHOICES = "slotChoices";

export type SlotChoiceRow = { id: string } & EventSlotChoiceFields;

function mapSlotChoice(id: string, data: Record<string, unknown>): SlotChoiceRow | null {
  const dateKey = typeof data.dateKey === "string" ? data.dateKey : "";
  const period = data.period;
  const cohort = data.cohort;
  const destinationLabel = typeof data.destinationLabel === "string" ? data.destinationLabel : "";
  const startTime = typeof data.startTime === "string" ? data.startTime : "";
  if (!/^\d{8}$/.test(dateKey)) return null;
  if (period !== "morning" && period !== "afternoon" && period !== "evening") return null;
  if (cohort !== "A" && cohort !== "B") return null;
  const lineIndex = typeof data.lineIndex === "number" ? data.lineIndex : 0;
  if (lineIndex !== 0 && lineIndex !== 1) return null;
  if (!destinationLabel) return null;
  const row: SlotChoiceRow = {
    id,
    dateKey,
    period: period as EventSlotPeriod,
    cohort: cohort as LobbyCohort,
    lineIndex,
    destinationLabel,
  };
  if (/^\d{2}:\d{2}$/.test(startTime)) row.startTime = startTime;
  if (typeof data.eventDetail === "string") row.eventDetail = data.eventDetail;
  if (typeof data.sortOrder === "number") row.sortOrder = data.sortOrder;
  return row;
}

/** 公開イベントに紐づく行き先一覧（運営が Console で投入） */
export function subscribeEventSlotChoices(
  eventId: string,
  onData: (rows: SlotChoiceRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(
    collection(db, "events", eventId, SLOT_CHOICES),
    orderBy("dateKey", "asc"),
    orderBy("period", "asc"),
    orderBy("cohort", "asc"),
    orderBy("lineIndex", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: SlotChoiceRow[] = [];
      snap.forEach((d) => {
        const row = mapSlotChoice(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      });
      if (process.env.NODE_ENV === "development" && snap.size > list.length) {
        console.warn(
          `[Lobby slotChoices / ${eventId}] ${snap.size} 件中 ${list.length} 件のみ有効。各ドキュメントに dateKey（8桁の日付文字列）・period（morning|afternoon|evening）・cohort（A|B）・destinationLabel（空でない文字列）・lineIndex（0 または 1）が必要です。`
        );
      }
      onData(list);
    },
    (err) => {
      const code = "code" in err ? String((err as { code: string }).code) : "";
      if (code === "failed-precondition") {
        onError?.("行き先の取得に失敗しました。");
      } else if (code === "permission-denied") {
        onError?.("行き先の取得に失敗しました。");
      } else {
        onError?.("行き先の取得に失敗しました。");
      }
    }
  );
}
