export type MatchLinkTimestamps = {
  createdAt?: unknown;
  lastMatchedAt?: unknown;
};

export function matchTimestampMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return null;
}

/** チャット解放ウィンドウの起点（初回マッチと再マッチのうち新しい方） */
export function chatWindowStartFromLink(fields: MatchLinkTimestamps): Date | null {
  const ms = [matchTimestampMs(fields.lastMatchedAt), matchTimestampMs(fields.createdAt)].filter(
    (n): n is number => n !== null
  );
  if (ms.length === 0) return null;
  return new Date(Math.max(...ms));
}

export function mergeLinkTimestamps(
  prev: MatchLinkTimestamps | undefined,
  next: MatchLinkTimestamps
): MatchLinkTimestamps {
  if (!prev) return { ...next };
  const out: MatchLinkTimestamps = { ...prev };
  const nextCreated = matchTimestampMs(next.createdAt);
  const prevCreated = matchTimestampMs(prev.createdAt);
  if (nextCreated !== null && (prevCreated === null || nextCreated < prevCreated)) {
    out.createdAt = next.createdAt;
  }
  const nextLast = matchTimestampMs(next.lastMatchedAt);
  const prevLast = matchTimestampMs(prev.lastMatchedAt);
  if (nextLast !== null && (prevLast === null || nextLast > prevLast)) {
    out.lastMatchedAt = next.lastMatchedAt;
  }
  return out;
}
