"use client";

import type { SlotChoiceRow } from "@/lib/firestore-event-slot-choices";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";
import { EventSlotChoiceDisplay } from "@/components/event-slot-choice-display";

type Props = {
  rows: SlotChoiceRow[];
  dateKey: string;
  period: EventSlotPeriod;
  cohort: LobbyCohort | null;
};

/** 行き先の一覧表示のみ（参加登録・記録なし） */
export function EventPeriodSlotList({ rows, dateKey, period, cohort }: Props) {
  if (cohort !== "A" && cohort !== "B") return null;
  const list = rows
    .filter((r) => r.dateKey === dateKey && r.period === period && r.cohort === cohort)
    .sort((a, b) => a.lineIndex - b.lineIndex);

  if (list.length === 0) return null;

  return (
    <ul className="space-y-4">
      {list.map((choice) => (
        <li key={choice.id}>
          <EventSlotChoiceDisplay choice={choice} period={period} />
        </li>
      ))}
    </ul>
  );
}
