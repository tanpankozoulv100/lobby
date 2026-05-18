"use client";

import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import type { PublishedAnnouncementRow } from "@/lib/firestore-announcements";

function formatPublishedAt(ts: Timestamp) {
  return ts.toDate().toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2a5 5 0 00-5 5v2.1c0 .5-.2 1-.5 1.4L5.1 13.2A1 1 0 006 15h12a1 1 0 00.9-1.5l-1.4-2.7c-.3-.4-.5-.9-.5-1.4V7a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10 17a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  rows: PublishedAnnouncementRow[] | null;
  hasUnread: boolean;
  onMarkSeen: () => void;
};

export function DashboardHomeAnnouncements({ rows, hasUnread, onMarkSeen }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasUnread) setOpen(true);
  }, [hasUnread]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows && rows.length > 0) {
      onMarkSeen();
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-zinc-200/80 bg-[var(--lobby-cream)] shadow-sm">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
          <BellIcon className="h-5 w-5" />
          {hasUnread ? (
            <span
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
              aria-hidden
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-900">お知らせ</span>
          {hasUnread ? (
            <span className="ml-2 text-xs font-medium text-red-600">新着あり</span>
          ) : null}
          {rows && rows.length > 0 && !open ? (
            <p className="mt-0.5 truncate text-xs text-zinc-500">{rows[0]!.title}</p>
          ) : null}
        </span>
        <span className="text-xs text-zinc-400">{open ? "閉じる" : "開く"}</span>
      </button>

      {open ? (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-2">
          {rows === null ? (
            <p className="text-sm text-zinc-500">読み込み中…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-600">お知らせはありません。</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
                >
                  <p className="text-[11px] text-zinc-500">{formatPublishedAt(item.publishedAt)}</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-900">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-700">
                      {item.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
