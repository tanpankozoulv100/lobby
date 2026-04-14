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
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        .env.local の Firebase 設定を確認してください。
      </p>
    </section>
  );
}

function DashboardAnnouncementsLoaded() {
  const [rows, setRows] = useState<PublishedAnnouncementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePublishedAnnouncements(
      (list) => {
        setRows(list);
        setError(null);
      },
      (msg) => setError(msg)
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
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        運営からの公開メッセージです。追加・編集は Firebase Console（のち管理者機能）から行います。
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        {rows === null ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            公開中のお知らせはまだありません。Firestore の{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-700">announcements</code> に{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-700">isPublished: true</code> と{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-700">publishedAt</code>（タイムスタンプ）を入れたドキュメントを追加してください。
          </p>
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
