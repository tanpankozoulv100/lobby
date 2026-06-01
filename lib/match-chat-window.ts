import { getSeasonEndDate } from "@/lib/season-config";
import { matchTimestampMs, type MatchLinkTimestamps } from "@/lib/match-link-times";

const CHAT_WINDOW_HOURS = 24;
const FINAL_DAY_CHAT_WINDOW_HOURS = 72;

function ymdInJst(d: Date): string {
  const dtf = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/** マッチ日に応じたチャット／再マッチ待ち時間（時間） */
export function matchChatWindowHours(matchedAt: Date): number {
  return ymdInJst(matchedAt) === ymdInJst(getSeasonEndDate())
    ? FINAL_DAY_CHAT_WINDOW_HOURS
    : CHAT_WINDOW_HOURS;
}

export function rematchAllowedAfter(lastMatchAt: Date): Date {
  const hours = matchChatWindowHours(lastMatchAt);
  return new Date(lastMatchAt.getTime() + hours * 60 * 60 * 1000);
}

export function getRematchCooldownMessage(lastMatchAt: Date, now = new Date()): string | null {
  const allowedAfter = rematchAllowedAfter(lastMatchAt);
  if (now.getTime() >= allowedAfter.getTime()) return null;

  const windowHours = matchChatWindowHours(lastMatchAt);
  const remainMs = allowedAfter.getTime() - now.getTime();
  const remainHours = Math.max(1, Math.ceil(remainMs / (60 * 60 * 1000)));
  return `再マッチは前回のマッチから${windowHours}時間経過後にできます。あと約${remainHours}時間お待ちください。`;
}

export function latestMatchInstantFromLinkFields(
  ...fieldsList: Array<MatchLinkTimestamps | undefined>
): Date | null {
  const msList = fieldsList
    .map((fields) => {
      if (!fields) return null;
      const ms = [matchTimestampMs(fields.lastMatchedAt), matchTimestampMs(fields.createdAt)].filter(
        (n): n is number => n !== null
      );
      return ms.length ? Math.max(...ms) : null;
    })
    .filter((n): n is number => n !== null);

  if (msList.length === 0) return null;
  return new Date(Math.max(...msList));
}
