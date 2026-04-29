"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import type { PublishedEventRow } from "@/lib/firestore-events";
import type { SlotChoiceRow } from "@/lib/firestore-event-slot-choices";
import type { UserEventSignupRow } from "@/lib/firestore-event-signups";
import type { EventDisplayWindowRow } from "@/lib/firestore-event-display-window";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";
import { dateKeyFromLocalDate } from "@/lib/calendar-utils";
import { EventSlotSection } from "@/components/event-slot-section";

const NO_PREFETCHED_SLOTS: SlotChoiceRow[] = [];

const TABS: { period: EventSlotPeriod; label: string }[] = [
  { period: "morning", label: "朝イベント" },
  { period: "afternoon", label: "昼イベント" },
  { period: "evening", label: "夕イベント" },
];

type Props = {
  user: User;
  selectedDate: Date;
  onClose: () => void;
  events: PublishedEventRow[];
  signups: UserEventSignupRow[];
  rowsByEvent: Record<string, SlotChoiceRow[]>;
  cohort: LobbyCohort;
  displayWindow: EventDisplayWindowRow | null;
};

function hasSlotsFor(
  rowsByEvent: Record<string, SlotChoiceRow[]>,
  cohort: LobbyCohort,
  eventId: string,
  dateKey: string,
  period: EventSlotPeriod
): boolean {
  return (rowsByEvent[eventId] ?? []).some(
    (r) => r.dateKey === dateKey && r.period === period && r.cohort === cohort
  );
}

function anyEventHasSlots(
  events: PublishedEventRow[],
  rowsByEvent: Record<string, SlotChoiceRow[]>,
  cohort: LobbyCohort,
  dateKey: string,
  period: EventSlotPeriod
): boolean {
  return events.some((ev) => hasSlotsFor(rowsByEvent, cohort, ev.id, dateKey, period));
}

export function EventCalendarDetailSheet({
  user,
  selectedDate,
  onClose,
  events,
  signups,
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

  const showEmpty = !anyEventHasSlots(events, rowsByEvent, cohort, dateKey, activePeriod);

  return (
    <div className="mt-3 rounded-t-2xl border border-t-zinc-200 bg-white px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:border-zinc-600 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <p className="font-serif text-base font-semibold text-zinc-900 dark:text-zinc-50">{headerLabel}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map(({ period, label }) => {
          const active = activePeriod === period;
          const line =
            period === "morning"
              ? "border-amber-500 text-amber-600"
              : period === "afternoon"
                ? "border-orange-400 text-orange-600"
                : "border-violet-500 text-violet-700";
          const inactive = "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400";
          return (
            <button
              key={period}
              type="button"
              onClick={() => setActivePeriod(period)}
              className={`flex flex-1 flex-col items-center gap-1 border-b-2 pb-2 pt-1 text-[11px] font-medium transition ${
                active ? line : inactive
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {period === "morning" ? "☀" : period === "afternoon" ? "◐" : "☾"}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {showEmpty ? (
          <div className="rounded-xl bg-zinc-50 px-4 py-8 text-center dark:bg-zinc-800/50">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">開催はありません</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              他の日から参加可能なイベントをチェックしよう！
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((ev) => {
              if (!hasSlotsFor(rowsByEvent, cohort, ev.id, dateKey, activePeriod)) return null;
              return (
                <div key={ev.id} className="border-b border-zinc-100 pb-5 last:border-0 last:pb-0 dark:border-zinc-800">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{ev.title}</h3>
                  {ev.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {ev.description}
                    </p>
                  ) : null}
                  <EventSlotSection
                    user={user}
                    eventId={ev.id}
                    signupsAll={signups}
                    focusDateKey={dateKey}
                    focusPeriod={activePeriod}
                    prefetchedRows={rowsByEvent[ev.id] ?? NO_PREFETCHED_SLOTS}
                    showCohortHint={false}
                    cohortOverride={cohort}
                    displayWindow={displayWindow}
                    sheetVariant
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
