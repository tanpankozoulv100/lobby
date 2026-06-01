"use client";

import { useState } from "react";
import type { PublishedEventRow } from "@/lib/firestore-events";
import type { SlotChoiceRow } from "@/lib/firestore-event-slot-choices";
import type { EventDisplayWindowRow } from "@/lib/firestore-event-display-window";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";
import { dateKeyFromLocalDate, isDateKeyInRange } from "@/lib/calendar-utils";
import { EventPeriodSlotList } from "@/components/event-period-slot-list";
import { EVENT_PERIOD_ORDER, EVENT_PERIOD_UI } from "@/lib/event-period-styles";

type Props = {
  selectedDate: Date;
  onClose: () => void;
  events: PublishedEventRow[];
  rowsByEvent: Record<string, SlotChoiceRow[]>;
  cohort: LobbyCohort;
  displayWindow: EventDisplayWindowRow | null;
};

function hasSlotsFor(
  rowsByEvent: Record<string, SlotChoiceRow[]>,
  cohort: LobbyCohort,
  eventId: string,
  dateKey: string,
  period: EventSlotPeriod,
  displayWindow: EventDisplayWindowRow | null
): boolean {
  return (rowsByEvent[eventId] ?? []).some(
    (r) =>
      r.dateKey === dateKey &&
      r.period === period &&
      r.cohort === cohort &&
      (!displayWindow ||
        isDateKeyInRange(r.dateKey, displayWindow.visibleFromDateKey, displayWindow.visibleToDateKey))
  );
}

function anyEventHasSlots(
  events: PublishedEventRow[],
  rowsByEvent: Record<string, SlotChoiceRow[]>,
  cohort: LobbyCohort,
  dateKey: string,
  period: EventSlotPeriod,
  displayWindow: EventDisplayWindowRow | null
): boolean {
  return events.some((ev) => hasSlotsFor(rowsByEvent, cohort, ev.id, dateKey, period, displayWindow));
}

export function EventCalendarDetailSheet({
  selectedDate,
  onClose,
  events,
  rowsByEvent,
  cohort,
  displayWindow,
}: Props) {
  const [activePeriod, setActivePeriod] = useState<EventSlotPeriod>("morning");

  const dateKey = dateKeyFromLocalDate(selectedDate);
  const headerLabel = selectedDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const showEmpty = !anyEventHasSlots(events, rowsByEvent, cohort, dateKey, activePeriod, displayWindow);

  return (
    <div className="mt-3 max-h-[min(70dvh,520px)] overflow-y-auto overscroll-y-contain rounded-t-2xl border border-t border-zinc-200 bg-white px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] [-webkit-overflow-scrolling:touch]">
      <div className="flex items-start justify-between gap-2">
        <p className="font-serif text-base font-semibold text-zinc-900">{headerLabel}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex border-b border-zinc-200">
        {EVENT_PERIOD_ORDER.map((period) => {
          const active = activePeriod === period;
          const ui = EVENT_PERIOD_UI[period];
          return (
            <button
              key={period}
              type="button"
              onClick={() => setActivePeriod(period)}
              className={`flex flex-1 flex-col items-center gap-1 border-b-2 pb-2 pt-1 text-[11px] font-medium transition ${
                active ? ui.tabActiveClass : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {ui.icon}
              </span>
              {ui.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {showEmpty ? (
          <div className="rounded-xl bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-zinc-800">開催はありません</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              他の日付や時間帯をご確認ください。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((ev) => {
              if (!hasSlotsFor(rowsByEvent, cohort, ev.id, dateKey, activePeriod, displayWindow)) {
                return null;
              }
              return (
                <div key={ev.id} className="border-b border-zinc-100 pb-5 last:border-0 last:pb-0">
                  {ev.description ? (
                    <p className="mb-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600">{ev.description}</p>
                  ) : null}
                  <EventPeriodSlotList
                    rows={rowsByEvent[ev.id] ?? []}
                    dateKey={dateKey}
                    period={activePeriod}
                    cohort={cohort}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
