"use client";

import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  subscribePublishedAnnouncements,
  type PublishedAnnouncementRow,
} from "@/lib/firestore-announcements";

function formatPublishedAt(ts: Timestamp) {
  return ts.toDate().toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AnnouncementsConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">お知らせ</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        接続できませんでした。しばらく経ってからお試しください。
      </p>
    </section>
  );
}

function DashboardAnnouncementsLoaded() {
  const [rows, setRows] = useState<PublishedAnnouncementRow[] | null>(null);

  useEffect(() => {
    const unsub = subscribePublishedAnnouncements(
      (list) => {
        setRows(list);
      },
      () => {}
    );
    return () => {
      unsub?.();
    };
  }, []);

  return (
    <section
      id="announcements"
      className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40"
    >
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">お知らせ</h2>
      <div className="mt-4">
        {rows === null ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">お知らせはありません。</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatPublishedAt(item.publishedAt)}</p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">{item.title}</p>
                {item.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{item.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function DashboardAnnouncementsSection() {
  if (!isFirebaseConfigComplete()) {
    return <AnnouncementsConfigMissing />;
  }
  return <DashboardAnnouncementsLoaded />;
}
