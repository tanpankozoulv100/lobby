"use client";

import { useState } from "react";
import type { Timestamp } from "firebase/firestore";
import type { PublishedAnnouncementRow } from "@/lib/firestore-announcements";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";

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
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<PublishedAnnouncementRow | null>(null);

  const openList = () => {
    setListOpen(true);
    if (rows && rows.length > 0) onMarkSeen();
  };

  return (
    <>
      <button
        type="button"
        onClick={openList}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/15 bg-gradient-to-b from-[#a82c3e] to-[#79101f] px-4 py-3 text-left shadow-[0_8px_20px_rgba(60,10,20,0.4)] transition active:scale-[0.99]"
        aria-haspopup="dialog"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <BellIcon className="h-5 w-5" />
          {hasUnread ? (
            <span
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-[#8c1b2c]"
              aria-hidden
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-white">お知らせ</span>
          {hasUnread ? (
            <span className="ml-2 text-xs font-medium text-amber-200">新着あり</span>
          ) : null}
        </span>
        <svg className="h-4 w-4 shrink-0 text-white/70" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <LobbyBottomSheet open={listOpen} title="お知らせ" onClose={() => setListOpen(false)}>
        {rows === null ? (
          <p className="py-6 text-center text-sm text-zinc-500">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-600">お知らせはありません。</p>
        ) : (
          <ul className="space-y-2 pt-2">
            {rows.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex w-full items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-left transition active:bg-zinc-100"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-zinc-500">{formatPublishedAt(item.publishedAt)}</span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-zinc-900">{item.title}</span>
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </LobbyBottomSheet>

      <LobbyBottomSheet
        open={selected !== null}
        title={selected?.title ?? "お知らせ"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="pt-2">
            <p className="text-[11px] text-zinc-500">{formatPublishedAt(selected.publishedAt)}</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">{selected.title}</p>
            {selected.body ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{selected.body}</p>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">本文はありません。</p>
            )}
          </div>
        ) : null}
      </LobbyBottomSheet>
    </>
  );
}
