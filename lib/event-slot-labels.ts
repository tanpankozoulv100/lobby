import type { EventSlotPeriod } from "@/lib/lobby-firestore-types";

const PERIOD_JA: Record<EventSlotPeriod, string> = {
  morning: "朝",
  afternoon: "昼",
  evening: "夜",
};

export function formatEventDateKey(dateKey: string): string {
  if (!/^\d{8}$/.test(dateKey)) return dateKey;
  return `${dateKey.slice(0, 4)}/${dateKey.slice(4, 6)}/${dateKey.slice(6, 8)}`;
}

export function periodLabelJa(period: EventSlotPeriod): string {
  return PERIOD_JA[period];
}

export const PERIODS_ORDER: EventSlotPeriod[] = ["morning", "afternoon", "evening"];
