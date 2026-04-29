"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  subscribeEventSlotChoices,
  type SlotChoiceRow,
} from "@/lib/firestore-event-slot-choices";
import { getLobbyCohortForSeason } from "@/lib/lobby-cohort";
import {
  resolveCohortAtDateKey,
  subscribeUserCohortWeeks,
  type CohortWeekRow,
} from "@/lib/firestore-cohort-weeks";
import {
  subscribeEventDisplayWindow,
  type EventDisplayWindowRow,
} from "@/lib/firestore-event-display-window";
import { isDateKeyInRange } from "@/lib/calendar-utils";

/** 各イベントの slotChoices を購読し、カレンダー用ドットと行データをまとめる */
export function useEventCalendarSlots(uid: string, eventIds: string[] | null | undefined) {
  const cohort = useMemo(() => getLobbyCohortForSeason(uid), [uid]);
  const [rowsByEvent, setRowsByEvent] = useState<Record<string, SlotChoiceRow[]>>({});
  const [cohortWeeks, setCohortWeeks] = useState<CohortWeekRow[]>([]);
  const [displayWindow, setDisplayWindow] = useState<EventDisplayWindowRow | null>(null);
  const eventIdsKey = useMemo(() => (eventIds?.length ? eventIds.join("|") : ""), [eventIds]);

  const cohortForDateKey = useCallback(
    (dateKey: string) => resolveCohortAtDateKey(cohortWeeks, dateKey, cohort),
    [cohortWeeks, cohort]
  );

  useEffect(() => {
    if (!eventIdsKey) {
      startTransition(() => {
        setRowsByEvent({});
      });
      return;
    }
    const ids = eventIds ?? [];
    const unsubs: (() => void)[] = [];
    for (const id of ids) {
      const u = subscribeEventSlotChoices(
        id,
        (rows) => {
          setRowsByEvent((p) => ({ ...p, [id]: rows }));
        },
        () => {
          setRowsByEvent((p) => ({ ...p, [id]: [] }));
        }
      );
      if (u) unsubs.push(u);
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, [eventIds, eventIdsKey]);

  useEffect(() => {
    const unsub = subscribeUserCohortWeeks(uid, (rows) => setCohortWeeks(rows), () => setCohortWeeks([]));
    return () => {
      unsub?.();
    };
  }, [uid]);

  useEffect(() => {
    const unsub = subscribeEventDisplayWindow((row) => setDisplayWindow(row), () => setDisplayWindow(null));
    return () => {
      unsub?.();
    };
  }, []);

  const markersByDate = useMemo(() => {
    const m = new Map<string, { daytime: boolean; evening: boolean }>();
    if (!eventIds) return m;
    for (const id of eventIds) {
      for (const r of rowsByEvent[id] ?? []) {
        if (displayWindow && !isDateKeyInRange(r.dateKey, displayWindow.visibleFromDateKey, displayWindow.visibleToDateKey)) {
          continue;
        }
        if (r.cohort !== cohortForDateKey(r.dateKey)) continue;
        const cur = m.get(r.dateKey) ?? { daytime: false, evening: false };
        if (r.period === "morning" || r.period === "afternoon") cur.daytime = true;
        if (r.period === "evening") cur.evening = true;
        m.set(r.dateKey, cur);
      }
    }
    return m;
  }, [rowsByEvent, cohortForDateKey, displayWindow, eventIds]);

  return { rowsByEvent, markersByDate, cohort, cohortForDateKey, displayWindow };
}
