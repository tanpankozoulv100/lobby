"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  subscribePublishedAnnouncements,
  type PublishedAnnouncementRow,
} from "@/lib/firestore-announcements";
import { hasUnreadAnnouncements, markAnnouncementsSeen } from "@/lib/announcement-read-state";

export function useAnnouncementUnread(uid: string | null) {
  const [rows, setRows] = useState<PublishedAnnouncementRow[] | null>(null);
  const [readTick, setReadTick] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigComplete()) {
      setRows([]);
      return;
    }
    let unsub: (() => void) | null = null;
    // 予約配信は publishedAt<=now でフィルタするため、定期的に now を更新して再購読する
    const start = () => {
      unsub?.();
      unsub = subscribePublishedAnnouncements(
        (list) => setRows(list),
        () => setRows((prev) => prev ?? [])
      );
    };
    start();
    const iv = window.setInterval(start, 60_000);
    return () => {
      window.clearInterval(iv);
      unsub?.();
    };
  }, []);

  const hasUnread = useMemo(() => {
    if (!uid || rows === null) return false;
    void readTick;
    return hasUnreadAnnouncements(rows, uid);
  }, [rows, uid, readTick]);

  const markSeen = useCallback(() => {
    if (!uid || !rows?.length) return;
    markAnnouncementsSeen(uid, rows[0]!.publishedAt.toMillis());
    setReadTick((t) => t + 1);
  }, [uid, rows]);

  return { rows, hasUnread, markSeen };
}
