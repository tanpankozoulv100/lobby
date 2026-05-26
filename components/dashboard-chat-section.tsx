"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigComplete } from "@/lib/firebase";
import { subscribeChatPeers, type ChatPeerEntry } from "@/lib/firestore-chat-date";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import { ChatConversation } from "@/components/chat-conversation";
import { MatchedPeerDetailSheet } from "@/components/matched-peer-detail-sheet";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import {
  mergeMatchLinks,
  subscribeInboundLinks,
  subscribeOutboundLinks,
} from "@/lib/firestore-connections";
import {
  ensureUserProfile,
  subscribeUserProfile,
} from "@/lib/firestore-users";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";

function formatExpiryShort(d: Date): string {
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function fetchDisplayName(uid: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) return uid.slice(0, 8);
  const snap = await getDoc(doc(db, "users", uid));
  const name = snap.data()?.displayName;
  if (typeof name === "string" && name.trim()) return name.trim();
  return `No.${uid.slice(0, 6)}`;
}

function ChatConfigMissing() {
  return (
    <div className="-mx-4 bg-[var(--lobby-cream)]">
      <h1 className="py-3 text-center font-serif text-lg font-semibold text-[var(--lobby-red)]">チャット</h1>
      <p className="px-4 pb-6 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </div>
  );
}

function TalkListRow({
  peer,
  displayName,
  isStaff,
  myAnswers,
  onSelect,
}: {
  peer: ChatPeerEntry;
  displayName: string;
  isStaff: boolean;
  myAnswers: CompatibilityAnswers | undefined;
  onSelect: () => void;
}) {
  const subtitle = isStaff
    ? "運営チャット"
    : peer.isActive
      ? `送信期限 ${formatExpiryShort(peer.expiresAt)}`
      : "過去のチャット（閲覧のみ）";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 border-b border-zinc-200/60 px-4 py-3.5 text-left transition active:bg-[var(--lobby-red)]/5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-300/90 text-base font-semibold text-white">
          {displayName.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[15px] font-medium text-zinc-900">{displayName}</span>
            {!isStaff ? (
              <MatchCompatibilityInline peerUid={peer.uid} myAnswers={myAnswers} className="text-[13px]" />
            ) : null}
          </span>
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
  const [peers, setPeers] = useState<ChatPeerEntry[] | null>(null);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [selectedPeer, setSelectedPeer] = useState<ChatPeerEntry | null>(null);
  const [myAnswers, setMyAnswers] = useState<CompatibilityAnswers | undefined>();
  const [encounterByPeer, setEncounterByPeer] = useState<Record<string, number>>({});
  const [profilePeerUid, setProfilePeerUid] = useState<string | null>(null);

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
      { isLobbyStaff: isStaff }
    );
    return () => {
      unsub?.();
    };
  }, [user.uid, isStaff]);

  useEffect(() => {
    if (!peers?.length) return;
    let cancelled = false;
    void (async () => {
      const names: Record<string, string> = {};
      await Promise.all(
        peers.map(async (p) => {
          names[p.uid] = await fetchDisplayName(p.uid);
        })
      );
      if (!cancelled) setPeerNames(names);
    })();
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
          peerDisplayName={peerNames[selectedPeer.uid] ?? selectedPeer.uid.slice(0, 8)}
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
    <div className="-mx-4 flex min-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] flex-col bg-[var(--lobby-cream)]">
      <h1 className="shrink-0 border-b border-zinc-200/60 py-3 text-center font-serif text-lg font-semibold text-[var(--lobby-red)]">
        チャット
      </h1>

      {peers === null ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">読み込み中…</p>
      ) : !sortedPeers?.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-zinc-600">
            会場でQR交換してマッチすると、
            <br />
            ここにトークが表示されます。
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {sortedPeers.map((peer) => (
            <TalkListRow
              key={peer.uid}
              peer={peer}
              displayName={peerNames[peer.uid] ?? "…"}
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
