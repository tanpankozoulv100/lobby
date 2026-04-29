import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { EventSlotPeriod, EventSignupFields } from "@/lib/lobby-firestore-types";
import type { SlotChoiceRow } from "@/lib/firestore-event-slot-choices";

const EVENT_SIGNUPS = "eventSignups";

export function eventSignupDocId(dateKey: string, period: EventSlotPeriod): string {
  return `${dateKey}__${period}`;
}

export type UserEventSignupRow = { id: string } & EventSignupFields;

function mapSignup(id: string, data: Record<string, unknown>): UserEventSignupRow | null {
  const eventId = typeof data.eventId === "string" ? data.eventId : "";
  const dateKey = typeof data.dateKey === "string" ? data.dateKey : "";
  const period = data.period;
  const slotChoiceId = typeof data.slotChoiceId === "string" ? data.slotChoiceId : "";
  if (!eventId || !/^\d{8}$/.test(dateKey)) return null;
  if (period !== "morning" && period !== "afternoon" && period !== "evening") return null;
  if (!slotChoiceId) return null;
  return {
    id,
    eventId,
    dateKey,
    period: period as EventSlotPeriod,
    slotChoiceId,
    updatedAt: data.updatedAt as UserEventSignupRow["updatedAt"],
  };
}

/** ユーザーのイベント参加記録（サブコレクションまるごと） */
export function subscribeUserEventSignups(
  uid: string,
  onData: (rows: UserEventSignupRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const ref = collection(db, "users", uid, EVENT_SIGNUPS);
  return onSnapshot(
    ref,
    (snap) => {
      const list: UserEventSignupRow[] = [];
      snap.forEach((d) => {
        const row = mapSignup(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      });
      onData(list);
    },
    () => {
      onError?.("参加記録の取得に失敗しました。");
    }
  );
}

/**
 * 選択肢が公開データと一致するか確認してから保存（改ざんで別イベントの ID を指定されるのを防ぐ）
 */
export async function saveEventSignup(
  uid: string,
  eventId: string,
  dateKey: string,
  period: EventSlotPeriod,
  choice: SlotChoiceRow
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { ok: false, message: "Firestore に接続できません。" };
  }
  if (choice.dateKey !== dateKey || choice.period !== period) {
    return { ok: false, message: "選択内容が不正です。" };
  }
  const slotRef = doc(db, "events", eventId, "slotChoices", choice.id);
  const slotSnap = await getDoc(slotRef);
  if (!slotSnap.exists()) {
    return { ok: false, message: "この行き先は利用できません。" };
  }

  const signupId = eventSignupDocId(dateKey, period);
  const userSignupRef = doc(db, "users", uid, EVENT_SIGNUPS, signupId);
  try {
    await setDoc(userSignupRef, {
      eventId,
      dateKey,
      period,
      slotChoiceId: choice.id,
      cohortAtSignup: choice.cohort,
      destinationLabelAtSignup: choice.destinationLabel,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied") {
      return { ok: false, message: "保存が拒否されました。" };
    }
    return { ok: false, message: "保存に失敗しました。" };
  }
}

export async function clearEventSignup(
  uid: string,
  _eventId: string,
  dateKey: string,
  period: EventSlotPeriod
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { ok: false, message: "Firestore に接続できません。" };
  }
  const signupId = eventSignupDocId(dateKey, period);
  const userSignupRef = doc(db, "users", uid, EVENT_SIGNUPS, signupId);
  try {
    await deleteDoc(userSignupRef);
    return { ok: true };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied") {
      return { ok: false, message: "削除が拒否されました。" };
    }
    return { ok: false, message: "削除に失敗しました。" };
  }
}
