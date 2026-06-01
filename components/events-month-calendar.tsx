"use client";

import {
  buildCalendarWeeks,
  dateKeyFromLocalDate,
  formatYearMonthJa,
  isSameLocalCalendarDay,
  startOfMonth,
} from "@/lib/calendar-utils";
import { EVENT_PERIOD_ORDER, EVENT_PERIOD_UI } from "@/lib/event-period-styles";
import type { DayPeriodMarkers } from "@/lib/event-calendar-markers";

const WEEKDAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

type Props = {
  visibleMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  /** 日付キー → 朝・昼・夕の枠あり */
  slotMarkersByDate: Map<string, DayPeriodMarkers>;
};

export function EventsMonthCalendar({
  visibleMonth,
  onPrevMonth,
  onNextMonth,
  selectedDate,
  onSelectDate,
  slotMarkersByDate,
}: Props) {
  const monthStart = startOfMonth(visibleMonth);
  const weeks = buildCalendarWeeks(monthStart);
  const today = new Date();
  const todayKey = dateKeyFromLocalDate(today);

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
          aria-label="前の月"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center font-serif text-base font-semibold tracking-wide text-[var(--lobby-red)]">
          {formatYearMonthJa(monthStart)}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold tracking-wide text-zinc-400">
        {WEEKDAYS_EN.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map(({ date, inCurrentMonth }) => {
              const key = dateKeyFromLocalDate(date);
              const selected = selectedDate != null && isSameLocalCalendarDay(date, selectedDate);
              const isToday = key === todayKey;
              const mk = slotMarkersByDate.get(key);
              const hasDots =
                mk && (mk.morning || mk.afternoon || mk.evening) && !selected;
              return (
                <button
                  key={`${date.getTime()}-${wi}`}
                  type="button"
                  onClick={() => onSelectDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))}
                  className="flex min-h-[2.85rem] flex-col items-center justify-center gap-0.5 py-1 transition"
                >
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm tabular-nums",
                      selected
                        ? "bg-[var(--lobby-red)] font-semibold text-white"
                        : inCurrentMonth
                          ? "text-zinc-900"
                          : "text-zinc-300",
                      !selected && isToday ? "ring-1 ring-zinc-300" : "",
                      !selected ? "hover:bg-zinc-50" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {date.getDate()}
                  </span>
                  {hasDots ? (
                    <span className="mt-0.5 flex gap-0.5" aria-hidden>
                      {EVENT_PERIOD_ORDER.map((period) =>
                        mk[period] ? (
                          <span
                            key={period}
                            className={`h-1.5 w-1.5 rounded-full ${EVENT_PERIOD_UI[period].dotClass}`}
                            title={EVENT_PERIOD_UI[period].label}
                          />
                        ) : null
                      )}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-3 text-[10px] text-zinc-500">
        {EVENT_PERIOD_ORDER.map((period) => (
          <span key={period} className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${EVENT_PERIOD_UI[period].dotClass}`} aria-hidden />
            {EVENT_PERIOD_UI[period].label.replace("イベント", "")}
          </span>
        ))}
      </div>
    </div>
  );
}
