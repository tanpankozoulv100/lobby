"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { subscribeChatPeers, type ChatPeerEntry } from "@/lib/firestore-chat-date";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import { ChatConversation } from "@/components/chat-conversation";
import { DashboardDateInviteSection } from "@/components/dashboard-date-invite-section";
import { MatchedPeerDetailSheet } from "@/components/matched-peer-detail-sheet";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import {
  mergeMatchLinks,
  subscribeInboundLinks,
  subscribeOutboundLinks,
} from "@/lib/firestore-connections";
import {
  ensureUserProfile,
  fetchUserProfile,
  subscribeUserProfile,
} from "@/lib/firestore-users";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";
import { ProfileAvatarCircle } from "@/components/profile-avatar-circle";
import { ProfileHitokotoBubble } from "@/components/profile-hitokoto-bubble";
import { useUserSeason } from "@/lib/use-user-season";

function formatExpiryShort(d: Date): string {
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatMetDate(d: Date): string {
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}

function ChatConfigMissing() {
  return (
    <div>
      <h1 className="sr-only">レター</h1>
      <p className="pb-4 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </div>
  );
}

function TalkListRow({
  peer,
  displayName,
  avatarPath,
  bio,
  isStaff,
  myAnswers,
  onSelect,
}: {
  peer: ChatPeerEntry;
  displayName: string;
  avatarPath?: string;
  bio?: string;
  isStaff: boolean;
  myAnswers: CompatibilityAnswers | undefined;
  onSelect: () => void;
}) {
  const subtitle = isStaff
    ? "運営レター"
    : peer.isActive
      ? `手紙が書けます（期限 ${formatExpiryShort(peer.expiresAt)}）`
      : "過去の手紙（閲覧のみ）";

  return (
    <li className="lobby-desk-letter">
      <button
        type="button"
        onClick={onSelect}
        className="lobby-desk-letter-btn flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <ProfileAvatarCircle
          displayName={displayName}
          avatarPath={avatarPath}
          className="h-12 w-12 text-base"
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[15px] font-medium text-zinc-900">{displayName}</span>
            {!isStaff ? (
              <MatchCompatibilityInline peerUid={peer.uid} myAnswers={myAnswers} className="text-[13px]" />
            ) : null}
          </span>
          {!isStaff && bio?.trim() ? (
            <ProfileHitokotoBubble text={bio} tail="left" className="mt-1.5 ml-1" />
          ) : null}
          {!isStaff ? (
            <span className="mt-0.5 block truncate text-xs text-zinc-500">
              出会った日 {formatMetDate(peer.matchedAt)}
            </span>
          ) : null}
          <span className={`mt-0.5 block truncate text-xs ${peer.isActive ? "text-zinc-500" : "text-zinc-400"}`}>
            {subtitle}
          </span>
        </span>
        <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function DashboardChatLoaded({ user }: { user: User }) {
  const { isStaff } = useLobbyStaff(user.uid);
  const { season } = useUserSeason(user.uid);
  const [peers, setPeers] = useState<ChatPeerEntry[] | null>(null);
  const [peerMeta, setPeerMeta] = useState<
    Record<string, { displayName: string; avatarPath?: string; bio?: string }>
  >({});
  const [selectedPeer, setSelectedPeer] = useState<ChatPeerEntry | null>(null);
  const [myAnswers, setMyAnswers] = useState<CompatibilityAnswers | undefined>();
  const [myAvatarPath, setMyAvatarPath] = useState<string | undefined>();
  const [myDisplayName, setMyDisplayName] = useState("あなた");
  const [encounterByPeer, setEncounterByPeer] = useState<Record<string, number>>({});
  const [profilePeerUid, setProfilePeerUid] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    void ensureUserProfile(user.uid, user.email).then(() => {
      unsub = subscribeUserProfile(user.uid, (p) => {
        setMyAnswers(p?.compatibilityAnswers);
        setMyAvatarPath(p?.avatarPath);
        setMyDisplayName(p?.displayName?.trim() || "あなた");
      });
    });
    return () => unsub?.();
  }, [user.uid, user.email]);

  useEffect(() => {
    let outbound: Parameters<typeof mergeMatchLinks>[0] = [];
    let inbound: Parameters<typeof mergeMatchLinks>[1] = [];
    const sync = () => {
      const merged = mergeMatchLinks(outbound, inbound);
      setEncounterByPeer(Object.fromEntries(merged.map((m) => [m.peerUid, m.encounterCount])));
    };
    const u1 = subscribeOutboundLinks(user.uid, (rows) => {
      outbound = rows;
      sync();
    });
    const u2 = subscribeInboundLinks(user.uid, (rows) => {
      inbound = rows;
      sync();
    });
    return () => {
      u1?.();
      u2?.();
    };
  }, [user.uid]);

  const sortedPeers = useMemo(() => {
    if (!peers) return null;
    return [...peers].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.matchedAt.getTime() - a.matchedAt.getTime();
    });
  }, [peers]);

  useEffect(() => {
    const unsub = subscribeChatPeers(
      user.uid,
      (rows) => setPeers(rows),
      () => setPeers([]),
      { isLobbyStaff: isStaff, seasonEndAt: season.endAt }
    );
    return () => {
      unsub?.();
    };
  }, [user.uid, isStaff, season.endAt]);

  useEffect(() => {
    if (!peers?.length) return;
    let cancelled = false;
    void Promise.all(
      peers.map(async (p) => {
        const profile = await fetchUserProfile(p.uid);
        return [
          p.uid,
          {
            displayName: profile?.displayName?.trim() || `No.${p.uid.slice(0, 6)}`,
            avatarPath: profile?.avatarPath,
            bio: profile?.bio,
          },
        ] as const;
      })
    ).then((pairs) => {
      if (!cancelled) setPeerMeta(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [peers]);

  if (selectedPeer) {
    const canSend = isStaff || selectedPeer.isActive;
    const profileUid = profilePeerUid;
    return (
      <>
        <ChatConversation
          user={user}
          peer={selectedPeer}
          peerDisplayName={
            peerMeta[selectedPeer.uid]?.displayName ?? selectedPeer.uid.slice(0, 8)
          }
          peerAvatarPath={peerMeta[selectedPeer.uid]?.avatarPath}
          myDisplayName={myDisplayName}
          myAvatarPath={myAvatarPath}
          isStaff={isStaff}
          canSend={canSend}
          myAnswers={myAnswers}
          onOpenPeerProfile={() => setProfilePeerUid(selectedPeer.uid)}
          onBack={() => setSelectedPeer(null)}
        />
        {profileUid ? (
          <MatchedPeerDetailSheet
            open
            onClose={() => setProfilePeerUid(null)}
            user={user}
            peerUid={profileUid}
            encounterCount={encounterByPeer[profileUid] ?? 1}
            myAnswers={myAnswers}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="lobby-desk flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">レター</h1>

      <div className="lobby-desk-props" aria-hidden>
        <span className="lobby-desk-pad" />
        <span className="lobby-desk-envelope">
          <span className="lobby-desk-envelope-flap" />
          <span className="lobby-desk-wax" />
        </span>
        <span className="lobby-desk-pen" />
      </div>

      <div className="relative z-[1] px-3 pt-3">
        <DashboardDateInviteSection user={user} />
      </div>

      <p className="lobby-desk-caption">机の上の手紙</p>

      {peers === null ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--lobby-cream)]/80">読み込み中…</p>
      ) : !sortedPeers?.length ? (
        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-[var(--lobby-cream)]/85">
            会場でQR交換してマッチすると、
            <br />
            ここに手紙のやり取りが表示されます。
          </p>
        </div>
      ) : (
        <ul className="lobby-desk-letters min-h-0 flex-1 overflow-y-auto">
          {sortedPeers.map((peer) => (
            <TalkListRow
              key={peer.uid}
              peer={peer}
              displayName={peerMeta[peer.uid]?.displayName ?? "…"}
              avatarPath={peerMeta[peer.uid]?.avatarPath}
              bio={peerMeta[peer.uid]?.bio}
              isStaff={isStaff}
              myAnswers={myAnswers}
              onSelect={() => setSelectedPeer(peer)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardChatSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <ChatConfigMissing />;
  }
  return <DashboardChatLoaded user={user} />;
}
