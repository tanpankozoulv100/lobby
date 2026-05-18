"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigComplete } from "@/lib/firebase";
import {
  mergeMatchLinks,
  subscribeInboundLinks,
  subscribeOutboundLinks,
} from "@/lib/firestore-connections";
import {
  ensureDateInviteTicketsByMatchCount,
  sendDateInvite,
  subscribeActiveDateInviteTickets,
  subscribeChatPeers,
  type ActiveDateInviteTicket,
  type ChatPeerEntry,
} from "@/lib/firestore-chat-date";
import {
  chatThreadId,
  sendChatMessage,
  subscribeChatMessages,
  type ChatMessageRow,
} from "@/lib/firestore-chat";
import { subscribeBlockedPeerUids } from "@/lib/firestore-safety";
import { useLobbyStaff } from "@/lib/use-lobby-staff";

function formatMessageTime(ts: unknown): string {
  if (
    ts &&
    typeof ts === "object" &&
    "toDate" in ts &&
    typeof (ts as { toDate: () => Date }).toDate === "function"
  ) {
    return (ts as { toDate: () => Date }).toDate().toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
}

function formatExpiry(d: Date): string {
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
    <section className="rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] p-5 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-zinc-900">チャット</h2>
      <p className="mt-3 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </section>
  );
}

function ChatConversation({
  user,
  peer,
  peerDisplayName,
  isStaff,
  canSend,
  onBack,
}: {
  user: User;
  peer: ChatPeerEntry;
  peerDisplayName: string;
  isStaff: boolean;
  canSend: boolean;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessageRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadId = chatThreadId(user.uid, peer.uid);

  useEffect(() => {
    const unsub = subscribeChatMessages(
      threadId,
      (rows) => {
        setMessages(rows);
        setLoadError(null);
      },
      (msg) => {
        setLoadError(msg);
        setMessages([]);
      }
    );
    return () => unsub?.();
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSendError(null);
    setSending(true);
    const res = await sendChatMessage(user.uid, peer.uid, draft);
    setSending(false);
    if (res.ok) {
      setDraft("");
    } else {
      setSendError(res.message);
    }
  }, [user.uid, peer.uid, draft, canSend]);

  return (
    <div className="flex min-h-[min(70dvh,520px)] flex-col rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] shadow-sm">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          ← 一覧
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-zinc-900">{peerDisplayName}</p>
          <p className="text-[11px] text-zinc-500">
            {isStaff
              ? "運営: 期限なし"
              : canSend
                ? `送信期限 ${formatExpiry(peer.expiresAt)}`
                : "期限切れ・履歴のみ"}
          </p>
        </div>
      </div>

      <div
        className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {loadError ? (
          <p className="text-sm text-amber-800">{loadError}</p>
        ) : messages === null ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">まだメッセージがありません。最初の一言を送ってみましょう。</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderUid === user.uid;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-md bg-[var(--lobby-red)] text-white"
                      : "rounded-bl-md bg-zinc-100 text-zinc-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/80" : "text-zinc-500"}`}>
                    {formatMessageTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {!canSend ? (
        <p className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 text-center text-xs leading-relaxed text-zinc-600">
          チャットの送信期限が過ぎています。過去のメッセージは閲覧できます。同じ相手と再マッチすると、続きから送信できます。
        </p>
      ) : (
        <div className="border-t border-zinc-100 p-3">
          <div className="flex gap-2">
            <textarea
              rows={2}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="メッセージを入力"
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending && draft.trim()) void handleSend();
                }
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => void handleSend()}
              className="self-end rounded-xl bg-[var(--lobby-red)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {sending ? "…" : "送信"}
            </button>
          </div>
          {sendError ? <p className="mt-2 text-xs text-amber-800">{sendError}</p> : null}
        </div>
      )}
    </div>
  );
}

function DashboardChatLoaded({ user }: { user: User }) {
  const { isStaff } = useLobbyStaff(user.uid);
  const [peers, setPeers] = useState<ChatPeerEntry[]>([]);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [selectedPeer, setSelectedPeer] = useState<ChatPeerEntry | null>(null);
  const [matchedRows, setMatchedRows] = useState<{ peerUid: string }[]>([]);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [ticketRows, setTicketRows] = useState<ActiveDateInviteTicket[]>([]);
  const [inviteToUid, setInviteToUid] = useState("");
  const [inviteLocation, setInviteLocation] = useState("");
  const [inviteProposedAt, setInviteProposedAt] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const blockedSet = useMemo(() => new Set(blockedUids), [blockedUids]);
  const activePeers = useMemo(() => peers.filter((p) => p.isActive), [peers]);
  const historyPeers = useMemo(() => peers.filter((p) => !p.isActive), [peers]);
  const inviteEligibleUids = useMemo(
    () => activePeers.map((p) => p.uid).filter((uid) => !blockedSet.has(uid)),
    [activePeers, blockedSet]
  );
  const effectiveInviteToUid = useMemo(() => {
    if (inviteToUid && inviteEligibleUids.includes(inviteToUid)) return inviteToUid;
    return inviteEligibleUids[0] ?? "";
  }, [inviteToUid, inviteEligibleUids]);

  useEffect(() => {
    const unsub = subscribeChatPeers(
      user.uid,
      (rows) => setPeers(rows),
      () => setPeers([]),
      { isLobbyStaff: isStaff }
    );
    const unsubTickets = subscribeActiveDateInviteTickets(
      user.uid,
      (rows) => setTicketRows(rows),
      () => setTicketRows([])
    );
    let outbound: Parameters<typeof mergeMatchLinks>[0] = [];
    let inbound: Parameters<typeof mergeMatchLinks>[1] = [];
    const syncMatches = () => {
      const merged = mergeMatchLinks(outbound, inbound);
      setMatchedRows(merged);
      void ensureDateInviteTicketsByMatchCount(user.uid, merged.length);
    };
    const unsubMatchesOut = subscribeOutboundLinks(user.uid, (rows) => {
      outbound = rows;
      syncMatches();
    });
    const unsubMatchesIn = subscribeInboundLinks(user.uid, (rows) => {
      inbound = rows;
      syncMatches();
    });
    const unsubBlocked = subscribeBlockedPeerUids(user.uid, setBlockedUids);
    return () => {
      unsub?.();
      unsubTickets?.();
      unsubMatchesOut?.();
      unsubMatchesIn?.();
      unsubBlocked?.();
    };
  }, [user.uid, isStaff]);

  useEffect(() => {
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

  const handleSendDateInvite = useCallback(async () => {
    setInviteNotice(null);
    setInvitePending(true);
    const dt = new Date(inviteProposedAt);
    if (Number.isNaN(dt.getTime())) {
      setInvitePending(false);
      setInviteNotice("候補日時を入力してください。");
      return;
    }
    const result = await sendDateInvite({
      uid: user.uid,
      toUid: effectiveInviteToUid,
      location: inviteLocation,
      proposedAt: dt,
      message: inviteMessage,
    });
    setInvitePending(false);
    if (result.ok) {
      setInviteNotice("デートお誘い券を送信しました。");
      setInviteLocation("");
      setInviteMessage("");
      setInviteProposedAt("");
      setShowInviteForm(false);
    } else {
      setInviteNotice(result.message);
    }
  }, [user.uid, effectiveInviteToUid, inviteLocation, inviteProposedAt, inviteMessage]);

  if (selectedPeer) {
    const canSend = isStaff || selectedPeer.isActive;
    return (
      <ChatConversation
        user={user}
        peer={selectedPeer}
        peerDisplayName={peerNames[selectedPeer.uid] ?? selectedPeer.uid.slice(0, 8)}
        isStaff={isStaff}
        canSend={canSend}
        onBack={() => setSelectedPeer(null)}
      />
    );
  }

  const hasAnyChat = peers.length > 0;

  const renderPeerButton = (peer: ChatPeerEntry) => (
    <li key={peer.uid}>
      <button
        type="button"
        onClick={() => setSelectedPeer(peer)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-left transition hover:border-[var(--lobby-red)]/30 hover:bg-[var(--lobby-cream)]"
      >
        <span className="font-medium text-zinc-900">{peerNames[peer.uid] ?? "読み込み中…"}</span>
        <span className="shrink-0 text-xs text-zinc-500">
          {isStaff ? "運営" : peer.isActive ? `〜${formatExpiry(peer.expiresAt)}` : "履歴"}
        </span>
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-zinc-900">チャット</h2>
        <p className="mt-1 text-sm text-zinc-600">
          QRでマッチした相手と1対1でやりとりできます（通常24時間、最終日マッチは72時間）。期限後も履歴は閲覧でき、再マッチで続きから送れます。
          {isStaff ? " 運営アカウントは常時利用できます。" : ""}
        </p>

        {!hasAnyChat ? (
          <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
            会場でQR交換してマッチすると、相手とのチャットが開放されます。
          </p>
        ) : (
          <>
            {activePeers.length > 0 ? (
              <ul className="mt-4 space-y-2">{activePeers.map(renderPeerButton)}</ul>
            ) : null}
            {historyPeers.length > 0 ? (
              <>
                <p className="mt-4 text-xs font-medium text-zinc-500">過去のチャット（閲覧のみ）</p>
                <ul className="mt-2 space-y-2">{historyPeers.map(renderPeerButton)}</ul>
              </>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setShowInviteForm((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold text-zinc-900">デートお誘い券</h3>
          <span className="text-xs text-zinc-500">{showInviteForm ? "閉じる" : "開く"}</span>
        </button>
        <p className="mt-1 text-xs text-zinc-600">10マッチごとに1枚・有効期限72時間</p>
        <p className="mt-2 text-sm text-zinc-700">利用可能: {ticketRows.length} 枚</p>
        {showInviteForm ? (
          <div className="mt-3 grid gap-2">
            <select
              value={effectiveInviteToUid}
              onChange={(e) => setInviteToUid(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-cream)] px-3 py-2.5 text-sm"
            >
              <option value="">送信先（マッチ済み相手）</option>
              {inviteEligibleUids.map((uid) => (
                <option key={uid} value={uid}>
                  {peerNames[uid] ?? uid.slice(0, 8)}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={inviteProposedAt}
              onChange={(e) => setInviteProposedAt(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
            <input
              type="text"
              maxLength={300}
              value={inviteLocation}
              onChange={(e) => setInviteLocation(e.target.value)}
              placeholder="場所"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
            <textarea
              rows={2}
              maxLength={500}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="メッセージ（任意）"
              className="w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={invitePending || !effectiveInviteToUid || ticketRows.length === 0}
              onClick={() => void handleSendDateInvite()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {invitePending ? "送信中…" : "お誘い券を送る"}
            </button>
            {inviteNotice ? <p className="text-sm text-zinc-700">{inviteNotice}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function DashboardChatSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <ChatConfigMissing />;
  }
  return <DashboardChatLoaded user={user} />;
}
