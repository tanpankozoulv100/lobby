"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type ActiveDateInviteTicket,
} from "@/lib/firestore-chat-date";
import { subscribeBlockedPeerUids } from "@/lib/firestore-safety";

async function fetchDisplayName(uid: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) return uid.slice(0, 8);
  const snap = await getDoc(doc(db, "users", uid));
  const name = snap.data()?.displayName;
  if (typeof name === "string" && name.trim()) return name.trim();
  return `No.${uid.slice(0, 6)}`;
}

function DateInviteConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-[var(--lobby-cream)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">デートお誘い券</h3>
      <p className="mt-2 text-sm text-zinc-600">接続できませんでした。</p>
    </section>
  );
}

function DashboardDateInviteLoaded({ user }: { user: User }) {
  const [ticketRows, setTicketRows] = useState<ActiveDateInviteTicket[]>([]);
  const [matchPeerUids, setMatchPeerUids] = useState<string[]>([]);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [inviteToUid, setInviteToUid] = useState("");
  const [inviteLocation, setInviteLocation] = useState("");
  const [inviteProposedAt, setInviteProposedAt] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const blockedSet = useMemo(() => new Set(blockedUids), [blockedUids]);
  const inviteTargets = useMemo(
    () => matchPeerUids.filter((uid) => !blockedSet.has(uid)),
    [matchPeerUids, blockedSet]
  );
  const effectiveInviteToUid = useMemo(() => {
    if (inviteToUid && inviteTargets.includes(inviteToUid)) return inviteToUid;
    return inviteTargets[0] ?? "";
  }, [inviteToUid, inviteTargets]);

  useEffect(() => {
    const unsubTickets = subscribeActiveDateInviteTickets(
      user.uid,
      (rows) => setTicketRows(rows),
      () => setTicketRows([])
    );
    let outbound: Parameters<typeof mergeMatchLinks>[0] = [];
    let inbound: Parameters<typeof mergeMatchLinks>[1] = [];
    const syncMatches = () => {
      const merged = mergeMatchLinks(outbound, inbound);
      setMatchPeerUids(merged.map((m) => m.peerUid));
      void ensureDateInviteTicketsByMatchCount(user.uid, merged.length);
    };
    const unsubOut = subscribeOutboundLinks(user.uid, (rows) => {
      outbound = rows;
      syncMatches();
    });
    const unsubIn = subscribeInboundLinks(user.uid, (rows) => {
      inbound = rows;
      syncMatches();
    });
    const unsubBlocked = subscribeBlockedPeerUids(user.uid, setBlockedUids);
    return () => {
      unsubTickets?.();
      unsubOut?.();
      unsubIn?.();
      unsubBlocked?.();
    };
  }, [user.uid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const names: Record<string, string> = {};
      await Promise.all(
        inviteTargets.map(async (uid) => {
          names[uid] = await fetchDisplayName(uid);
        })
      );
      if (!cancelled) setPeerNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteTargets]);

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
      setExpanded(false);
    } else {
      setInviteNotice(result.message);
    }
  }, [user.uid, effectiveInviteToUid, inviteLocation, inviteProposedAt, inviteMessage]);

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-[var(--lobby-cream)] p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--lobby-red)]">デートお誘い券</h3>
          <p className="mt-0.5 text-xs text-zinc-600">10マッチごとに1枚・有効期限72時間</p>
        </div>
        <span className="text-xs text-zinc-500">
          残り {ticketRows.length} 枚 · {expanded ? "閉じる" : "開く"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 grid gap-2 border-t border-zinc-200/80 pt-3">
          <select
            value={effectiveInviteToUid}
            onChange={(e) => setInviteToUid(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
          >
            <option value="">送信先（マッチ済み相手）</option>
            {inviteTargets.map((uid) => (
              <option key={uid} value={uid}>
                {peerNames[uid] ?? "読み込み中…"}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={inviteProposedAt}
            onChange={(e) => setInviteProposedAt(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
          />
          <input
            type="text"
            maxLength={300}
            value={inviteLocation}
            onChange={(e) => setInviteLocation(e.target.value)}
            placeholder="場所"
            className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
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
            className="rounded-xl bg-[var(--lobby-red)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {invitePending ? "送信中…" : "お誘い券を送る"}
          </button>
          {inviteNotice ? <p className="text-sm text-zinc-700">{inviteNotice}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export function DashboardDateInviteSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <DateInviteConfigMissing />;
  }
  return <DashboardDateInviteLoaded user={user} />;
}
