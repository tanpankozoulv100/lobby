"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  mergeMatchLinks,
  subscribeInboundLinks,
  subscribeOutboundLinks,
  type MergedMatchRow,
} from "@/lib/firestore-connections";
import { MatchedPeerDetailSheet } from "@/components/matched-peer-detail-sheet";
import { ensureUserProfile, fetchUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";
import { useProfileMediaUrl } from "@/lib/use-profile-media-url";
import { formatParticipantNoDisplay } from "@/lib/format-participant-no";
import { matchTimestampMs } from "@/lib/match-link-times";

type PeerMeta = { displayName: string; avatarPath?: string; participantNo?: number };
type SortMode = "no" | "match";

function HistoryConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] p-5 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-zinc-900">マッチング履歴</h2>
      <p className="mt-3 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </section>
  );
}

/** マッチ時刻（最新優先）をミリ秒で返す。 */
function matchMs(row: MergedMatchRow): number {
  return Math.max(matchTimestampMs(row.lastMatchedAt) ?? 0, matchTimestampMs(row.createdAt) ?? 0);
}

/** 1件分の行：左にルームキー（No.入り）、右にマッチ相手のアイコン。 */
function KeyRow({
  meta,
  onSelect,
}: {
  meta: PeerMeta | undefined;
  onSelect: () => void;
}) {
  const avatarUrl = useProfileMediaUrl(meta?.avatarPath);
  const displayName = meta?.displayName ?? "…";
  const noLabel = formatParticipantNoDisplay(meta?.participantNo ?? null, false);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="lobby-keyrow"
      aria-label={`${displayName} No.${noLabel}`}
    >
      <span className="lobby-keyrow-key">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/lobby-room-key.png" alt="" className="lobby-keyrow-key-img" />
        <span className="lobby-keyrow-no">No.{noLabel}</span>
      </span>
      <span className="lobby-keyrow-avatar">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="lobby-keyrow-avatar-img" />
        ) : (
          <span className="lobby-keyrow-avatar-initial">{displayName.slice(0, 1)}</span>
        )}
      </span>
    </button>
  );
}

function DashboardConnectionsLoaded({ user }: { user: User }) {
  const [links, setLinks] = useState<MergedMatchRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [myAnswers, setMyAnswers] = useState<CompatibilityAnswers | undefined>();
  const [peerMeta, setPeerMeta] = useState<Record<string, PeerMeta>>({});
  const [selectedPeer, setSelectedPeer] = useState<MergedMatchRow | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("no");

  useEffect(() => {
    let unsub: (() => void) | null = null;
    void ensureUserProfile(user.uid, user.email).then(() => {
      unsub = subscribeUserProfile(user.uid, (p) => setMyAnswers(p?.compatibilityAnswers));
    });
    return () => unsub?.();
  }, [user.uid, user.email]);

  useEffect(() => {
    let outbound: Parameters<typeof mergeMatchLinks>[0] = [];
    let inbound: Parameters<typeof mergeMatchLinks>[1] = [];
    const sync = () => setLinks(mergeMatchLinks(outbound, inbound));

    const u1 = subscribeOutboundLinks(user.uid, (rows) => {
      outbound = rows;
      sync();
      setLinksError(null);
    }, setLinksError);
    const u2 = subscribeInboundLinks(user.uid, (rows) => {
      inbound = rows;
      sync();
    });
    return () => {
      u1?.();
      u2?.();
    };
  }, [user.uid]);

  useEffect(() => {
    if (!links?.length) return;
    let cancelled = false;
    void Promise.all(
      links.map(async (row) => {
        const peer = await fetchUserProfile(row.peerUid);
        return [
          row.peerUid,
          {
            displayName: peer?.displayName?.trim() || `No.${row.peerUid.slice(0, 6)}`,
            avatarPath: peer?.avatarPath,
            participantNo: peer?.participantNo,
          } satisfies PeerMeta,
        ] as const;
      })
    ).then((pairs) => {
      if (!cancelled) setPeerMeta(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [links]);

  const sortedLinks = useMemo(() => {
    if (!links) return null;
    const arr = [...links];
    if (sortMode === "no") {
      arr.sort((a, b) => {
        const na = peerMeta[a.peerUid]?.participantNo ?? Number.MAX_SAFE_INTEGER;
        const nb = peerMeta[b.peerUid]?.participantNo ?? Number.MAX_SAFE_INTEGER;
        return na - nb;
      });
    } else {
      arr.sort((a, b) => matchMs(b) - matchMs(a));
    }
    return arr;
  }, [links, peerMeta, sortMode]);

  return (
    <div className="flex min-h-full flex-col px-1">
      <div className="lobby-sort">
        <p className="lobby-sort-label">並び替え</p>
        <div className="lobby-sort-tabs">
          <button
            type="button"
            className={sortMode === "no" ? "is-active" : ""}
            onClick={() => setSortMode("no")}
          >
            No.順
          </button>
          <button
            type="button"
            className={sortMode === "match" ? "is-active" : ""}
            onClick={() => setSortMode("match")}
          >
            マッチした順
          </button>
        </div>
      </div>

      {linksError ? (
        <p className="px-4 pb-1 text-center text-sm text-amber-200">{linksError}</p>
      ) : null}

      {sortedLinks === null ? (
        <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--lobby-cream)]/70">
          読み込み中…
        </p>
      ) : sortedLinks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--lobby-cream)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            まだ鍵はかかっていません
          </p>
          <p className="text-xs text-[var(--lobby-cream)]/70">
            マッチングした人の鍵がここに増えていきます
          </p>
        </div>
      ) : (
        <div className="lobby-history-list">
          {sortedLinks.map((row) => (
            <KeyRow
              key={row.peerUid}
              meta={peerMeta[row.peerUid]}
              onSelect={() => setSelectedPeer(row)}
            />
          ))}
        </div>
      )}

      {selectedPeer ? (
        <MatchedPeerDetailSheet
          open={!!selectedPeer}
          onClose={() => setSelectedPeer(null)}
          user={user}
          peerUid={selectedPeer.peerUid}
          encounterCount={selectedPeer.encounterCount}
          myAnswers={myAnswers}
        />
      ) : null}
    </div>
  );
}

export function DashboardConnectionsSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <HistoryConfigMissing />;
  }
  return <DashboardConnectionsLoaded user={user} />;
}
