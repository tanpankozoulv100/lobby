import type { PublishedAnnouncementRow } from "@/lib/firestore-announcements";

const STORAGE_PREFIX = "lobby_announcements_last_seen_ms_";

function storageKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}`;
}

export function getAnnouncementsLastSeenMs(uid: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function markAnnouncementsSeen(uid: string, latestPublishedAtMs: number): void {
  if (typeof window === "undefined" || !Number.isFinite(latestPublishedAtMs)) return;
  try {
    const prev = getAnnouncementsLastSeenMs(uid);
    if (latestPublishedAtMs > prev) {
      localStorage.setItem(storageKey(uid), String(latestPublishedAtMs));
    }
  } catch {
    /* ignore */
  }
}

export function hasUnreadAnnouncements(
  rows: PublishedAnnouncementRow[],
  uid: string
): boolean {
  if (rows.length === 0) return false;
  const latestMs = rows[0]!.publishedAt.toMillis();
  return latestMs > getAnnouncementsLastSeenMs(uid);
}
