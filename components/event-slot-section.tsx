"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { getLobbyCohortForSeason } from "@/lib/lobby-cohort";
import type { EventDisplayWindowRow } from "@/lib/firestore-event-display-window";
import { isDateKeyInRange } from "@/lib/calendar-utils";
import { formatEventDateKey, periodLabelJa, PERIODS_ORDER } from "@/lib/event-slot-labels";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";
import {
  subscribeEventSlotChoices,
  type SlotChoiceRow,
} from "@/lib/firestore-event-slot-choices";
import {
  clearEventSignup,
  filterSignupsForEvent,
  saveEventSignup,
  type UserEventSignupRow,
} from "@/lib/firestore-event-signups";

type Props = {
  user: User;
  eventId: string;
  signupsAll: UserEventSignupRow[];
  /** 指定時はその日の行き先だけ表示（カレンダー連動） */
  focusDateKey?: string | null;
  /** 指定時はその時間帯だけ（シートのタブ） */
  focusPeriod?: EventSlotPeriod | null;
  /** 親が slotChoices を既に購読しているとき二重購読を避ける */
  prefetchedRows?: SlotChoiceRow[];
  showCohortHint?: boolean;
  cohortOverride?: LobbyCohort;
  displayWindow?: EventDisplayWindowRow | null;
  /** 下部シート用の余白・文言 */
  sheetVariant?: boolean;
};

function choicesForCohort(rows: SlotChoiceRow[], cohort: LobbyCohort): SlotChoiceRow[] {
  return rows.filter((r) => r.cohort === cohort);
}

export function EventSlotSection({
  user,
  eventId,
  signupsAll,
  focusDateKey = null,
  focusPeriod = null,
  prefetchedRows,
  showCohortHint = true,
  cohortOverride,
  displayWindow,
  sheetVariant = false,
}: Props) {
  const hashedCohort = useMemo(() => getLobbyCohortForSeason(user.uid), [user.uid]);
  const cohort = cohortOverride ?? hashedCohort;
  const usePrefetch = prefetchedRows !== undefined;
  const [localRows, setLocalRows] = useState<SlotChoiceRow[] | null>(null);
  const [slotErr, setSlotErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo(
    (): SlotChoiceRow[] | null => (usePrefetch ? (prefetchedRows ?? []) : localRows),
    [usePrefetch, prefetchedRows, localRows]
  );

  const signups = useMemo(() => filterSignupsForEvent(signupsAll, eventId), [signupsAll, eventId]);

  useEffect(() => {
    if (usePrefetch) {
      return;
    }
    const unsub = subscribeEventSlotChoices(
      eventId,
      (list) => {
        setLocalRows(list);
        setSlotErr(null);
      },
      (msg) => setSlotErr(msg)
    );
    return () => {
      unsub?.();
    };
  }, [eventId, usePrefetch]);

  const filtered = useMemo(() => {
    const byCohort = choicesForCohort(rows ?? [], cohort);
    if (!displayWindow) return byCohort;
    return byCohort.filter((r) =>
      isDateKeyInRange(r.dateKey, displayWindow.visibleFromDateKey, displayWindow.visibleToDateKey)
    );
  }, [rows, cohort, displayWindow]);

  const byDateAndPeriod = useMemo(() => {
    const map = new Map<string, Map<EventSlotPeriod, SlotChoiceRow[]>>();
    for (const r of filtered) {
      if (!map.has(r.dateKey)) map.set(r.dateKey, new Map());
      const pm = map.get(r.dateKey)!;
      if (!pm.has(r.period)) pm.set(r.period, []);
      pm.get(r.period)!.push(r);
    }
    for (const pm of map.values()) {
      for (const [, arr] of pm) {
        arr.sort((a, b) => a.lineIndex - b.lineIndex);
      }
    }
    return map;
  }, [filtered]);

  const signupMap = useMemo(() => {
    const m = new Map<string, UserEventSignupRow>();
    for (const s of signups) {
      m.set(`${s.dateKey}__${s.period}`, s);
    }
    return m;
  }, [signups]);

  if (!usePrefetch && rows === null && !slotErr) {
    return <p className="mt-3 text-xs text-zinc-500">行き先を読み込み中…</p>;
  }

  if (slotErr) {
    return (
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        表示できませんでした。しばらくしてからお試しください。
      </p>
    );
  }

  if (!rows?.length) {
    return (
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">このイベントの行き先はまだありません。</p>
    );
  }

  const allDateKeys = [...byDateAndPeriod.keys()].sort();
  const dateKeysBase =
    focusDateKey && /^\d{8}$/.test(focusDateKey)
      ? allDateKeys.includes(focusDateKey)
        ? [focusDateKey]
        : []
      : allDateKeys;

  const dateKeysRender =
    focusPeriod && dateKeysBase.length > 0
      ? dateKeysBase.filter((dk) => (byDateAndPeriod.get(dk)?.get(focusPeriod) ?? []).length > 0)
      : dateKeysBase;

  if (dateKeysRender.length === 0 && focusDateKey) {
    if (sheetVariant && focusPeriod) {
      return (
        <div className={sheetVariant ? "mt-3" : "mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-600"}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            開催はありません
            <span className="mt-1 block text-[11px] leading-relaxed">
              他の日から参加可能なイベントをチェックしよう！
            </span>
          </p>
        </div>
      );
    }
    return (
      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-600">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          選択した日（{formatEventDateKey(focusDateKey)}）に、あなたのグループ向けの行き先枠はまだありません。
        </p>
      </div>
    );
  }

  const periodsToShow = focusPeriod ? PERIODS_ORDER.filter((p) => p === focusPeriod) : PERIODS_ORDER;

  const wrapClass = sheetVariant
    ? "mt-3"
    : "mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-600";

  return (
    <div className={wrapClass}>
      {actionError ? (
        <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {actionError}
        </p>
      ) : null}
      {showCohortHint ? (
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          あなたのグループ: <span className="text-[var(--lobby-red)]">{cohort}</span>（週ごとに自動更新）
        </p>
      ) : null}
      <div className={showCohortHint ? "mt-3 space-y-5" : "space-y-5"}>
        {dateKeysRender.map((dateKey) => (
          <div key={dateKey}>
            {!sheetVariant ? (
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{formatEventDateKey(dateKey)}</p>
            ) : null}
            <div className={sheetVariant ? "space-y-4" : "mt-2 space-y-4"}>
              {periodsToShow.map((period) => {
                const list = byDateAndPeriod.get(dateKey)?.get(period) ?? [];
                if (list.length === 0) return null;
                const key = `${dateKey}__${period}`;
                const current = signupMap.get(key);
                const saving = busyKey === key;

                return (
                  <fieldset key={key} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <legend className="px-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {periodLabelJa(period)}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {list.map((choice) => {
                        const selected = current?.slotChoiceId === choice.id;
                        return (
                          <label
                            key={choice.id}
                            className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-sm ${
                              selected
                                ? "border-[var(--lobby-red)] bg-white dark:bg-zinc-900"
                                : "border-transparent hover:bg-white/80 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`slot-${eventId}-${dateKey}-${period}`}
                              checked={selected}
                              disabled={saving}
                              onChange={() => {
                                void (async () => {
                                  setActionError(null);
                                  setBusyKey(key);
                                  const res = await saveEventSignup(user.uid, eventId, dateKey, period, choice);
                                  setBusyKey(null);
                                  if (!res.ok) setActionError(res.message);
                                })();
                              }}
                              className="mt-0.5"
                            />
                            <span className="text-zinc-800 dark:text-zinc-200">{choice.destinationLabel}</span>
                            {choice.eventDetail ? (
                              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{choice.eventDetail}</span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                    {current ? (
                      <button
                        type="button"
                        disabled={saving}
                        className="mt-2 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
                        onClick={() => {
                          void (async () => {
                            setActionError(null);
                            setBusyKey(key);
                            const res = await clearEventSignup(user.uid, eventId, dateKey, period);
                            setBusyKey(null);
                            if (!res.ok) setActionError(res.message);
                          })();
                        }}
                      >
                        この時間帯の選択を取り消す
                      </button>
                    ) : null}
                  </fieldset>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
