import type { EventSlotPeriod } from "@/lib/lobby-firestore-types";

/** デザイン案: 朝=オレンジ / 昼=黄 / 夕=紫 */
export const EVENT_PERIOD_UI: Record<
  EventSlotPeriod,
  { label: string; dotClass: string; tabActiveClass: string; icon: string }
> = {
  morning: {
    label: "朝イベント",
    dotClass: "bg-orange-500",
    tabActiveClass: "border-orange-500 text-orange-600",
    icon: "☀",
  },
  afternoon: {
    label: "昼イベント",
    dotClass: "bg-yellow-400",
    tabActiveClass: "border-yellow-400 text-yellow-700",
    icon: "◐",
  },
  evening: {
    label: "夕イベント",
    dotClass: "bg-violet-500",
    tabActiveClass: "border-violet-500 text-violet-700",
    icon: "☾",
  },
};

export const EVENT_PERIOD_ORDER: EventSlotPeriod[] = ["morning", "afternoon", "evening"];
