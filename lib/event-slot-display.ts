import type { EventSlotPeriod } from "@/lib/lobby-firestore-types";

function fallbackStartTime(period: EventSlotPeriod): string {
  if (period === "morning") return "09:00";
  if (period === "afternoon") return "13:00";
  return "18:00";
}

export function formatStartTimeLabel(raw: string | undefined, period: EventSlotPeriod): string {
  const t = (raw ?? "").trim();
  return /^\d{2}:\d{2}$/.test(t) ? t : fallbackStartTime(period);
}
