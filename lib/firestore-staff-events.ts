import {
  Timestamp,
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { checkIsLobbyStaff } from "@/lib/lobby-staff";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";

export { checkIsLobbyStaff };
const EVENTS = "events";
const SLOT_CHOICES = "slotChoices";

export type StaffEventListRow = {
  id: string;
  title: string;
  isPublished: boolean;
  startsAt: Timestamp;
};

export function subscribeStaffAllEvents(
  onData: (rows: StaffEventListRow[]) => void,
  onError?: (code: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("unavailable");
    return null;
  }
  const q = query(collection(db, EVENTS), orderBy("startsAt", "desc"), limit(40));
  return onSnapshot(
    q,
    (snap) => {
      const rows: StaffEventListRow[] = [];
      snap.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const title = typeof data.title === "string" ? data.title : "";
        const startsAt = data.startsAt instanceof Timestamp ? data.startsAt : null;
        if (!title || !startsAt) return;
        rows.push({
          id: d.id,
          title,
          isPublished: data.isPublished === true,
          startsAt,
        });
      });
      onData(rows);
    },
    (err) => {
      const code = "code" in err ? String((err as { code: string }).code) : "unknown";
      onError?.(code);
    }
  );
}

export async function createLobbyEventAsStaff(input: {
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  description?: string;
  locationSummary?: string;
  isPublished: boolean;
}): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore が初期化されていません。");
  const title = input.title.trim();
  if (!title) throw new Error("タイトルを入力してください。");

  const payload: Record<string, unknown> = {
    title,
    startsAt: Timestamp.fromDate(input.startsAt),
    isPublished: input.isPublished,
    createdAt: serverTimestamp(),
  };
  if (input.endsAt) payload.endsAt = Timestamp.fromDate(input.endsAt);
  const desc = input.description?.trim();
  if (desc) payload.description = desc;
  const loc = input.locationSummary?.trim();
  if (loc) payload.locationSummary = loc;

  const ref = await addDoc(collection(db, EVENTS), payload);
  return ref.id;
}

export async function addSlotChoiceAsStaff(
  eventId: string,
  input: {
    dateKey: string;
    period: EventSlotPeriod;
    cohort: LobbyCohort;
    lineIndex: 0 | 1;
    destinationLabel: string;
    sortOrder?: number;
  }
): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore が初期化されていません。");
  if (!/^\d{8}$/.test(input.dateKey)) throw new Error("日付は YYYYMMDD（8桁）で入力してください。");
  const label = input.destinationLabel.trim();
  if (!label) throw new Error("行き先ラベルを入力してください。");

  const payload: Record<string, unknown> = {
    dateKey: input.dateKey,
    period: input.period,
    cohort: input.cohort,
    lineIndex: input.lineIndex,
    destinationLabel: label,
  };
  if (typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)) {
    payload.sortOrder = input.sortOrder;
  }

  const ref = await addDoc(collection(db, EVENTS, eventId, SLOT_CHOICES), payload);
  return ref.id;
}
