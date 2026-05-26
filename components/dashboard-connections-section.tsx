"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  mergeMatchLinks,
  subscribeInboundLinks,
  subscribeOutboundLinks,
  type MergedMatchRow,
} from "@/lib/firestore-connections";
import { DashboardDateInviteSection } from "@/components/dashboard-date-invite-section";
import { MatchHistoryHelpModal } from "@/components/match-history-help-modal";
import { MatchedPeerDetailSheet } from "@/components/matched-peer-detail-sheet";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import { ensureUserProfile, fetchUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";
import { LOBBY_SEASON_UI } from "@/lib/season-config";
import {
  getMatchEncounterBadgeTone,
  MATCH_ENCOUNTER_BADGE_CLASS,
} from "@/lib/match-encounter";
import { useProfileMediaUrl } from "@/lib/use-profile-media-url";

function HistoryConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] p-5 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-zinc-900">マッチング履歴</h2>
      <p className="mt-3 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </section>
  );
}

function MatchGridAvatar({
  peerUid,
  encounterCount,
  displayName,
  avatarPath,
  myAnswers,
  onSelect,
}: {
  peerUid: string;
  encounterCount: number;
  displayName: string;
  avatarPath?: string;
  myAnswers: CompatibilityAnswers | undefined;
  onSelect: () => void;
}) {
  const avatarUrl = useProfileMediaUrl(avatarPath);
  const tone = getMatchEncounterBadgeTone(encounterCount);
  const badgeClass = MATCH_ENCOUNTER_BADGE_CLASS[tone];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-1 rounded-xl p-1 text-center transition active:bg-zinc-100"
    >
      <span className="relative">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-[72px] w-[72px] rounded-full object-cover" />
        ) : (
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600">
            {displayName.slice(0, 1)}
          </span>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] font-bold shadow ${badgeClass}`}
        >
          {encounterCount}
        </span>
      </span>
      <span className="flex max-w-full items-baseline justify-center gap-1 px-0.5">
        <span className="truncate text-[11px] font-medium text-zinc-800">{displayName}</span>
        <MatchCompatibilityInline peerUid={peerUid} myAnswers={myAnswers} className="text-[10px]" />
      </span>
    </button>
  );
}

function DashboardConnectionsLoaded({ user }: { user: User }) {
  const [links, setLinks] = useState<MergedMatchRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [myAnswers, setMyAnswers] = useState<CompatibilityAnswers | undefined>();
  const [peerMeta, setPeerMeta] = useState<
    Record<string, { displayName: string; avatarPath?: string }>
  >({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<MergedMatchRow | null>(null);

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
          },
        ] as const;
      })
    ).then((pairs) => {
      if (!cancelled) setPeerMeta(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [links]);

  return (
    <div className="-mx-4 space-y-4">
      <DashboardDateInviteSection user={user} />

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-[var(--lobby-cream)] shadow-sm">
        <div className="bg-[var(--lobby-red)] px-4 py-2.5 text-center text-sm font-medium text-white">
          あなたが参加中のシーズン
        </div>

        <div className="px-4 py-4">
          <h2 className="text-center font-serif text-lg font-semibold text-[var(--lobby-red)]">
            マッチング履歴
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-zinc-800">{LOBBY_SEASON_UI.cardTitle}</p>
          <p className="mt-1 text-center text-xs text-zinc-500">
            {LOBBY_SEASON_UI.participatingCountLabel}
          </p>

          <div className="mt-5 flex items-center justify-center gap-1">
            <h3 className="text-sm font-semibold text-zinc-900">これまでにマッチングした一覧</h3>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-bold text-zinc-500"
              aria-label="マッチング一覧の説明"
            >
              ?
            </button>
          </div>

          {linksError ? <p className="mt-3 text-center text-sm text-amber-800">{linksError}</p> : null}

          {links === null ? (
            <p className="mt-6 text-center text-sm text-zinc-500">読み込み中…</p>
          ) : links.length === 0 ? (
            <p className="mt-6 rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600">
              現在、マッチングしていません
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {links.map((row) => {
                const meta = peerMeta[row.peerUid];
                return (
                  <MatchGridAvatar
                    key={row.peerUid}
                    peerUid={row.peerUid}
                    encounterCount={row.encounterCount}
                    displayName={meta?.displayName ?? "…"}
                    avatarPath={meta?.avatarPath}
                    myAnswers={myAnswers}
                    onSelect={() => setSelectedPeer(row)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MatchHistoryHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

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
