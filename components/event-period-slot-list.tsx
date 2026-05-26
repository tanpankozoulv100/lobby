"use client";

import type { SlotChoiceRow } from "@/lib/firestore-event-slot-choices";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";
import { formatStartTimeLabel } from "@/lib/event-slot-display";

type Props = {
  rows: SlotChoiceRow[];
  dateKey: string;
  period: EventSlotPeriod;
  cohort: LobbyCohort;
};

/** 行き先の一覧表示のみ（参加登録・記録なし） */
export function EventPeriodSlotList({ rows, dateKey, period, cohort }: Props) {
  const list = rows
    .filter((r) => r.dateKey === dateKey && r.period === period && r.cohort === cohort)
    .sort((a, b) => a.lineIndex - b.lineIndex);

  if (list.length === 0) return null;

  return (
    <ul className="space-y-2">
      {list.map((choice) => {
        const timeLabel = formatStartTimeLabel(choice.startTime, period);
        return (
          <li
            key={choice.id}
            className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50"
          >
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              {timeLabel} {choice.destinationLabel}
            </p>
            {choice.eventDetail ? (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {choice.eventDetail}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
