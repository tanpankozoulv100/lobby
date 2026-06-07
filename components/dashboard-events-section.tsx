"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import type { PublishedEventRow } from "@/lib/firestore-events";
import type { EventDisplayWindowRow } from "@/lib/firestore-event-display-window";
import { EventCalendarDetailSheet } from "@/components/event-calendar-detail-sheet";
import { EventsMonthCalendar } from "@/components/events-month-calendar";
import { useEventCalendarSlots } from "@/components/use-event-calendar-slots";
import {
  addMonths,
  dateKeyFromLocalDate,
  parseDateKeyToLocalDate,
  startOfMonth,
} from "@/lib/calendar-utils";
import { formatCountdownBanner } from "@/lib/season-config";
import { getSeasonRemainingDaysForDisplay } from "@/lib/season-display";
import { useUserSeason } from "@/lib/use-user-season";
import type { SeasonDisplay } from "@/lib/season-display";

function EventsConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
      <h2 className="text-lg font-semibold text-zinc-900">イベント</h2>
      <p className="mt-3 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </section>
  );
}

function SeasonCountdownBanner({ season }: { season: SeasonDisplay }) {
  const days = getSeasonRemainingDaysForDisplay(season);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-100/80 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lobby-cream)] text-zinc-500 shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a5 5 0 0 0-5 5v2.5L5 14h14l-2-3.5V8a5 5 0 0 0-5-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9 18a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-xs font-medium text-zinc-600">{formatCountdownBanner(days)}</p>
    </div>
  );
}

function DisplayWeekBanner({ displayWindow }: { displayWindow: EventDisplayWindowRow | null }) {
  if (!displayWindow) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
        今週のイベントは準備中です。毎週木曜に次週（日曜〜土曜）分が公開されます。
      </p>
    );
  }
  return null;
}

type LoadedProps = {
  user: User;
  publishedEvents: PublishedEventRow[] | null;
  cohortFlipActive?: boolean;
};

function DashboardEventsLoaded({ user, publishedEvents: events, cohortFlipActive = false }: LoadedProps) {
  const { season } = useUserSeason(user.uid);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const eventIds = useMemo(() => events?.map((e) => e.id) ?? [], [events]);
  const { markersByDate, rowsByEvent, cohortForDateKey, displayWindow } = useEventCalendarSlots(
    user.uid,
    events === null ? null : eventIds,
    cohortFlipActive
  );

  useEffect(() => {
    if (!displayWindow) return;
    const d = parseDateKeyToLocalDate(displayWindow.visibleFromDateKey);
    if (!d) return;
    setVisibleMonth(startOfMonth(d));
  }, [displayWindow?.weekKey]);

  const handleSelectDate = (d: Date) => {
    const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedDate(normalized);
    if (
      normalized.getMonth() !== visibleMonth.getMonth() ||
      normalized.getFullYear() !== visibleMonth.getFullYear()
    ) {
      setVisibleMonth(startOfMonth(normalized));
    }
  };

  return (
    <section className="lobby-paper-calendar">
      <div className="flex flex-col gap-2">
        <SeasonCountdownBanner season={season} />
        <DisplayWeekBanner displayWindow={displayWindow} />
      </div>

      <div className="mt-4 space-y-4">
        {events === null ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : (
          <>
            {events.length === 0 ? (
              <p className="text-sm text-zinc-600">公開中のイベントはまだありません。</p>
            ) : null}

            <EventsMonthCalendar
              visibleMonth={visibleMonth}
              onPrevMonth={() => setVisibleMonth((m) => addMonths(m, -1))}
              onNextMonth={() => setVisibleMonth((m) => addMonths(m, 1))}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              slotMarkersByDate={markersByDate}
            />

            {selectedDate ? (
              <EventCalendarDetailSheet
                selectedDate={selectedDate}
                onClose={() => setSelectedDate(null)}
                events={events}
                rowsByEvent={rowsByEvent}
                cohort={cohortForDateKey(dateKeyFromLocalDate(selectedDate))}
                displayWindow={displayWindow}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

type SectionProps = {
  user: User;
  publishedEvents: PublishedEventRow[] | null;
  cohortFlipActive?: boolean;
};

export function DashboardEventsSection({ user, publishedEvents, cohortFlipActive = false }: SectionProps) {
  if (!isFirebaseConfigComplete()) {
    return <EventsConfigMissing />;
  }
  return <DashboardEventsLoaded user={user} publishedEvents={publishedEvents} cohortFlipActive={cohortFlipActive} />;
}
