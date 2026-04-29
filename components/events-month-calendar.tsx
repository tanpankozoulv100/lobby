"use client";

import {
  buildCalendarWeeks,
  dateKeyFromLocalDate,
  formatYearMonthJa,
  isSameLocalCalendarDay,
  startOfMonth,
} from "@/lib/calendar-utils";

const WEEKDAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export type DaySlotMarkers = { daytime: boolean; evening: boolean };

type Props = {
  visibleMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  /** 日付キー → 昼系（朝+昼）・夕の枠あり（あなたのグループ向け slotChoices 由来） */
  slotMarkersByDate: Map<string, DaySlotMarkers>;
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
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
              return (
                <button
                  key={`${date.getTime()}-${wi}`}
                  type="button"
                  onClick={() => onSelectDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))}
                  className={[
                    "relative flex min-h-[2.85rem] flex-col items-center justify-center rounded-full py-1 text-sm transition",
                    inCurrentMonth ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-300 dark:text-zinc-600",
                    selected
                      ? "bg-zinc-200 font-semibold text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                      : isToday
                        ? "ring-1 ring-zinc-300 dark:ring-zinc-600"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                  ].join(" ")}
                >
                  <span className="tabular-nums">{date.getDate()}</span>
                  {mk && (mk.daytime || mk.evening) && !selected ? (
                    <span className="mt-0.5 flex gap-0.5" aria-hidden>
                      {mk.daytime ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="朝・昼の枠あり" />
                      ) : null}
                      {mk.evening ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500" title="夕の枠あり" />
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
