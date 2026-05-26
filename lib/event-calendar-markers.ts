import type { EventSlotPeriod } from "@/lib/lobby-firestore-types";

export type DayPeriodMarkers = Record<EventSlotPeriod, boolean>;

export function emptyDayPeriodMarkers(): DayPeriodMarkers {
  return { morning: false, afternoon: false, evening: false };
}
