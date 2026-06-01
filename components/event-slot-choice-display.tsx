"use client";

import type { ReactNode } from "react";
import type { SlotChoiceRow } from "@/lib/firestore-event-slot-choices";
import type { EventSlotPeriod } from "@/lib/lobby-firestore-types";
import { formatStartTimeLabel } from "@/lib/event-slot-display";

type Props = {
  choice: SlotChoiceRow;
  period: EventSlotPeriod;
  /** 参加登録済みバッジなど */
  suffix?: ReactNode;
};

/** 行き先1件: 太字＝時刻＋場所、下に eventDetail（薄い枠なし） */
export function EventSlotChoiceDisplay({ choice, period, suffix }: Props) {
  const timeLabel = formatStartTimeLabel(choice.startTime, period);
  return (
    <div>
      <p className="text-sm font-bold leading-snug text-zinc-900">
        {timeLabel} {choice.destinationLabel}
        {suffix}
      </p>
      {choice.eventDetail ? (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">{choice.eventDetail}</p>
      ) : null}
    </div>
  );
}
