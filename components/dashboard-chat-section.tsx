"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { subscribeChatPeers, type ChatPeerEntry } from "@/lib/firestore-chat-date";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import { ChatConversation } from "@/components/chat-conversation";
import { LetterInviteScreen } from "@/components/letter-invite-screen";
import { LetterExchangeView } from "@/components/letter-exchange-view";
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

type LetterView = "hub" | "invite" | "send" | "read";

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
  subtitle,
  onSelect,
}: {
  peer: ChatPeerEntry;
  displayName: string;
  avatarPath?: string;
  bio?: string;
  isStaff: boolean;
  myAnswers: CompatibilityAnswers | undefined;
  subtitle: string;
  onSelect: () => void;
}) {
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

/** 相手選択リスト（レターを送る／届いたレターを読む 共通） */
function PeerListScreen({
  title,
  rows,
  meta,
  isStaff,
  myAnswers,
  subtitleFor,
  emptyMessage,
  onSelect,
  onBack,
}: {
  title: string;
  rows: ChatPeerEntry[] | null;
  meta: Record<string, { displayName: string; avatarPath?: string; bio?: string }>;
  isStaff: boolean;
  myAnswers: CompatibilityAnswers | undefined;
  subtitleFor: (peer: ChatPeerEntry) => string;
  emptyMessage: React.ReactNode;
  onSelect: (peer: ChatPeerEntry) => void;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex flex-col bg-[var(--lobby-cream)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-2 bg-[var(--lobby-red)] px-3 py-3 text-white">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-light"
          aria-label="戻る"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-medium">{title}</p>
        <span className="h-9 w-9" />
      </header>

      {rows === null ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">読み込み中…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          {emptyMessage}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {rows.map((peer) => (
            <TalkListRow
              key={peer.uid}
              peer={peer}
              displayName={meta[peer.uid]?.displayName ?? "…"}
              avatarPath={meta[peer.uid]?.avatarPath}
              bio={meta[peer.uid]?.bio}
              isStaff={isStaff}
              myAnswers={myAnswers}
              subtitle={subtitleFor(peer)}
              onSelect={() => onSelect(peer)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HubOption({
  title,
  desc,
  icon,
  onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="lobby-letter-option">
      <span className="lobby-letter-option-icon" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="lobby-letter-option-title block">{title}</span>
        <span className="lobby-letter-option-desc block">{desc}</span>
      </span>
      <svg className="lobby-letter-option-chevron h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function DashboardChatLoaded({ user }: { user: User }) {
  const { isStaff } = useLobbyStaff(user.uid);
  const { season } = useUserSeason(user.uid);
  const [peers, setPeers] = useState<ChatPeerEntry[] | null>(null);
  const [peerMeta, setPeerMeta] = useState<
    Record<string, { displayName: string; avatarPath?: string; bio?: string }>
  >({});
  const [view, setView] = useState<LetterView>("hub");
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

  const activePeers = useMemo(
    () => (sortedPeers ? sortedPeers.filter((p) => p.isActive) : null),
    [sortedPeers]
  );

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

  const goHub = () => {
    setSelectedPeer(null);
    setView("hub");
  };

  // 「レターを送る」相手を選択 → 作成画面（ChatConversation）
  if (view === "send" && selectedPeer) {
    const canSend = isStaff || selectedPeer.isActive;
    return (
      <>
        <ChatConversation
          user={user}
          peer={selectedPeer}
          peerDisplayName={peerMeta[selectedPeer.uid]?.displayName ?? selectedPeer.uid.slice(0, 8)}
          peerAvatarPath={peerMeta[selectedPeer.uid]?.avatarPath}
          myDisplayName={myDisplayName}
          myAvatarPath={myAvatarPath}
          isStaff={isStaff}
          canSend={canSend}
          myAnswers={myAnswers}
          onOpenPeerProfile={() => setProfilePeerUid(selectedPeer.uid)}
          onBack={() => setSelectedPeer(null)}
        />
        {profilePeerUid ? (
          <MatchedPeerDetailSheet
            open
            onClose={() => setProfilePeerUid(null)}
            user={user}
            peerUid={profilePeerUid}
            encounterCount={encounterByPeer[profilePeerUid] ?? 1}
            myAnswers={myAnswers}
          />
        ) : null}
      </>
    );
  }

  // 「届いたレターを読む」相手を選択 → 2封筒の閲覧画面
  if (view === "read" && selectedPeer) {
    return (
      <LetterExchangeView
        user={user}
        peer={selectedPeer}
        peerDisplayName={peerMeta[selectedPeer.uid]?.displayName ?? selectedPeer.uid.slice(0, 8)}
        onBack={() => setSelectedPeer(null)}
      />
    );
  }

  if (view === "invite") {
    return <LetterInviteScreen user={user} onBack={goHub} />;
  }

  if (view === "send") {
    return (
      <PeerListScreen
        title="レターを送る"
        rows={activePeers}
        meta={peerMeta}
        isStaff={isStaff}
        myAnswers={myAnswers}
        subtitleFor={(peer) =>
          isStaff ? "運営レター" : `手紙が書けます（期限 ${formatExpiryShort(peer.expiresAt)}）`
        }
        emptyMessage={
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lobby-red)]/10 text-2xl text-[var(--lobby-red)]">
              ×
            </span>
            <p className="text-sm font-medium text-zinc-800">レターを送れる相手がいません</p>
            <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
              レターはマッチングしてから24時間以内に、お互い1回だけ送れます。
            </p>
          </>
        }
        onSelect={(peer) => setSelectedPeer(peer)}
        onBack={goHub}
      />
    );
  }

  if (view === "read") {
    return (
      <PeerListScreen
        title="届いたレターを読む"
        rows={sortedPeers}
        meta={peerMeta}
        isStaff={isStaff}
        myAnswers={myAnswers}
        subtitleFor={(peer) =>
          peer.isActive ? "手紙のやり取りを見る" : "過去の手紙（閲覧のみ）"
        }
        emptyMessage={
          <p className="text-sm text-zinc-600">
            会場でQR交換してマッチすると、
            <br />
            ここに手紙のやり取りが表示されます。
          </p>
        }
        onSelect={(peer) => setSelectedPeer(peer)}
        onBack={goHub}
      />
    );
  }

  // ハブ（3択）
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

      <div className="relative z-[1] px-3 pt-4">
        <div className="lobby-letter-hub">
          <HubOption
            title="招待状を送る"
            desc="10マッチで1枚・特別なお誘い"
            onClick={() => setView("invite")}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.7" />
                <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" />
              </svg>
            }
          />
          <HubOption
            title="レターを送る"
            desc="マッチから24時間以内に1通"
            onClick={() => setView("send")}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 4h11l3 3v13H5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M8 9h6M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          />
          <HubOption
            title="届いたレターを読む"
            desc="これまでの手紙のやり取り"
            onClick={() => setView("read")}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 7l8 5 8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M4 7h16v11H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            }
          />
        </div>
      </div>

      <p className="lobby-desk-caption">机の上の手紙</p>
    </div>
  );
}

export function DashboardChatSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <ChatConfigMissing />;
  }
  return <DashboardChatLoaded user={user} />;
}
