import { isDateKeyInRange } from "@/lib/calendar-utils";
import type { EventDisplayWindowRow } from "@/lib/firestore-event-display-window";
import type { LobbyCohort } from "@/lib/lobby-firestore-types";

/** 表示週未設定時はユーザーに枠を見せない */
export function isDateInEventDisplayWindow(
  dateKey: string,
  displayWindow: EventDisplayWindowRow | null | undefined
): boolean {
  if (!displayWindow) return false;
  return isDateKeyInRange(dateKey, displayWindow.visibleFromDateKey, displayWindow.visibleToDateKey);
}

export function slotMatchesUserCohort(
  slotCohort: LobbyCohort,
  userCohort: LobbyCohort | null | undefined
): boolean {
  if (userCohort !== "A" && userCohort !== "B") return false;
  return slotCohort === userCohort;
}

export function isEventSlotVisibleToUser(
  slot: { dateKey: string; cohort: LobbyCohort },
  displayWindow: EventDisplayWindowRow | null | undefined,
  userCohortForDate: LobbyCohort | null | undefined
): boolean {
  if (!isDateInEventDisplayWindow(slot.dateKey, displayWindow)) return false;
  return slotMatchesUserCohort(slot.cohort, userCohortForDate);
}
