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
import { MatchedPeerDetailSheet } from "@/components/matched-peer-detail-sheet";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import { ensureUserProfile, fetchUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";
import { useUserSeason } from "@/lib/use-user-season";
import { getMatchEncounterBadgeTone } from "@/lib/match-encounter";
import { useProfileMediaUrl } from "@/lib/use-profile-media-url";
import { ProfileHitokotoBubble } from "@/components/profile-hitokoto-bubble";

function HistoryConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] p-5 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-zinc-900">マッチング履歴</h2>
      <p className="mt-3 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </section>
  );
}

/** マッチした相手を「壁に掛かるロビーのキー」として表示する。
 *  房（タッセル）の色はマッチ回数で 黄1 / 橙2 / 赤3+。 */
function LobbyKey({
  peerUid,
  encounterCount,
  displayName,
  avatarPath,
  bio,
  myAnswers,
  onSelect,
}: {
  peerUid: string;
  encounterCount: number;
  displayName: string;
  avatarPath?: string;
  bio?: string;
  myAnswers: CompatibilityAnswers | undefined;
  onSelect: () => void;
}) {
  const avatarUrl = useProfileMediaUrl(avatarPath);
  const tone = getMatchEncounterBadgeTone(encounterCount);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`lobby-key lobby-key--${tone}`}
      aria-label={`${displayName} とのマッチ ${encounterCount}回`}
    >
      <span className="lobby-key-hook" aria-hidden />
      <span className="lobby-key-tassel" aria-hidden>
        <span className="lobby-key-tassel-cap" />
        <span className="lobby-key-tassel-skirt" />
      </span>
      <span className="lobby-key-fob">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="lobby-key-avatar" />
        ) : (
          <span className="lobby-key-avatar lobby-key-avatar--initial">
            {displayName.slice(0, 1)}
          </span>
        )}
        <span className="lobby-key-tag">{encounterCount}</span>
      </span>
      <span className="lobby-key-bio">
        <ProfileHitokotoBubble text={bio} tail="bottom" />
      </span>
      <span className="lobby-key-name">
        <span className="lobby-key-name-text">{displayName}</span>
        <MatchCompatibilityInline peerUid={peerUid} myAnswers={myAnswers} className="text-[10px]" />
      </span>
    </button>
  );
}

function DashboardConnectionsLoaded({ user }: { user: User }) {
  const { season } = useUserSeason(user.uid);
  const [links, setLinks] = useState<MergedMatchRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [myAnswers, setMyAnswers] = useState<CompatibilityAnswers | undefined>();
  const [peerMeta, setPeerMeta] = useState<
    Record<string, { displayName: string; avatarPath?: string; bio?: string }>
  >({});
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
            bio: peer?.bio,
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
    <div className="-mx-4 -mt-3 -mb-4 flex min-h-full flex-col">
      <p className="px-4 pb-1 pt-3 text-center text-sm font-medium text-zinc-800">
        {season.cardTitle}
      </p>

      {linksError ? (
        <p className="px-4 pb-1 text-center text-sm text-amber-800">{linksError}</p>
      ) : null}

      {links === null ? (
        <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-zinc-500">
          読み込み中…
        </p>
      ) : links.length === 0 ? (
        <div className="lobby-keyrack lobby-keyrack--empty">
          <p className="lobby-keyrack-empty-text">まだ鍵はかかっていません</p>
          <p className="lobby-keyrack-empty-sub">マッチングした人の鍵がこの壁に増えていきます</p>
        </div>
      ) : (
        <div className="lobby-keyrack">
          {links.map((row) => {
            const meta = peerMeta[row.peerUid];
            return (
              <LobbyKey
                key={row.peerUid}
                peerUid={row.peerUid}
                encounterCount={row.encounterCount}
                displayName={meta?.displayName ?? "…"}
                avatarPath={meta?.avatarPath}
                bio={meta?.bio}
                myAnswers={myAnswers}
                onSelect={() => setSelectedPeer(row)}
              />
            );
          })}
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
