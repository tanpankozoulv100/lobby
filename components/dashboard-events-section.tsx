"use client";

import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { subscribePublishedEvents, type PublishedEventRow } from "@/lib/firestore-events";

function formatRange(startsAt: Timestamp, endsAt?: Timestamp) {
  const start = startsAt.toDate().toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (!endsAt) return start;
  const end = endsAt.toDate().toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${start} 〜 ${end}`;
}

function EventsConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">イベント</h2>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        .env.local の Firebase 設定を確認してください。
      </p>
    </section>
  );
}

function DashboardEventsLoaded() {
  const [events, setEvents] = useState<PublishedEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePublishedEvents(
      (list) => {
        setEvents(list);
        setError(null);
      },
      (msg) => setError(msg)
    );
    return () => {
      unsub?.();
    };
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">イベント</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        公開中のイベントのみ表示します。作成は現状 Firebase Console（のち管理者機能）から行います。
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        {events === null ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            公開中のイベントはまだありません。Firestore の <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-700">events</code>{" "}
            に <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-700">isPublished: true</code> のドキュメントを追加するとここに表示されます。
          </p>
        ) : (
          <ul className="space-y-4">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{ev.title}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {formatRange(ev.startsAt, ev.endsAt)}
                </p>
                {ev.locationSummary ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{ev.locationSummary}</p>
                ) : null}
                {ev.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{ev.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function DashboardEventsSection() {
  if (!isFirebaseConfigComplete()) {
    return <EventsConfigMissing />;
  }
  return <DashboardEventsLoaded />;
}
