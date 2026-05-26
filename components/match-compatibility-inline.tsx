"use client";

import { useEffect, useState } from "react";
import { computeCompatibilityMatch } from "@/lib/compatibility-match";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";
import { fetchUserProfile } from "@/lib/firestore-users";

/** 相手名の横に表示する相性パーセント（例: 75%） */
export function MatchCompatibilityInline({
  peerUid,
  myAnswers,
  className = "",
}: {
  peerUid: string;
  myAnswers: CompatibilityAnswers | undefined;
  className?: string;
}) {
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchUserProfile(peerUid).then((peer) => {
      if (cancelled) return;
      const result = computeCompatibilityMatch(myAnswers, peer?.compatibilityAnswers);
      setPercent(result.percent);
    });
    return () => {
      cancelled = true;
    };
  }, [peerUid, myAnswers]);

  if (percent == null) {
    return (
      <span className={`shrink-0 text-xs text-zinc-400 ${className}`} aria-hidden>
        …
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 text-sm font-semibold tabular-nums text-[var(--lobby-red)] ${className}`}
      aria-label={`相性 ${percent}パーセント`}
    >
      {percent}%
    </span>
  );
}
