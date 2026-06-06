"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
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

async function fetchDisplayName(uid: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) return uid.slice(0, 8);
  const snap = await getDoc(doc(db, "users", uid));
  const name = snap.data()?.displayName;
  if (typeof name === "string" && name.trim()) return name.trim();
  return `No.${uid.slice(0, 6)}`;
}

/** 「招待状を送る」全画面。チケットが無ければ注意書き、有れば送信先選択＋送信フォーム。 */
export function LetterInviteScreen({ user, onBack }: { user: User; onBack: () => void }) {
  const [ticketRows, setTicketRows] = useState<ActiveDateInviteTicket[] | null>(null);
  const [matchPeerUids, setMatchPeerUids] = useState<string[]>([]);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [inviteToUid, setInviteToUid] = useState("");
  const [inviteLocation, setInviteLocation] = useState("");
  const [inviteProposedAt, setInviteProposedAt] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const inviteTargets = useMemo(() => matchPeerUids, [matchPeerUids]);
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
    return () => {
      unsubTickets?.();
      unsubOut?.();
      unsubIn?.();
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

  const handleSend = useCallback(async () => {
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
      setSent(true);
      setInviteLocation("");
      setInviteMessage("");
      setInviteProposedAt("");
    } else {
      setInviteNotice(result.message);
    }
  }, [user.uid, effectiveInviteToUid, inviteLocation, inviteProposedAt, inviteMessage]);

  const ticketCount = ticketRows?.length ?? 0;
  const hasTicket = ticketCount > 0;

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
        <p className="min-w-0 flex-1 text-center text-sm font-medium">招待状を送る</p>
        <span className="h-9 w-9" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {ticketRows === null ? (
          <p className="py-8 text-center text-sm text-zinc-500">読み込み中…</p>
        ) : !hasTicket ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lobby-red)]/10 text-2xl text-[var(--lobby-red)]">
              ×
            </span>
            <p className="text-sm font-medium text-zinc-800">招待状を保有していません</p>
            <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
              10人とマッチングするごとに招待状が1枚付与されます。
            </p>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lobby-red)]/10 text-2xl text-[var(--lobby-red)]">
              ✓
            </span>
            <p className="text-sm font-medium text-zinc-800">招待状を送信しました</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-full bg-[var(--lobby-red)] px-5 py-2 text-sm font-medium text-white"
            >
              レターメニューに戻る
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-xs text-zinc-500">残り {ticketCount} 枚 · 有効期限72時間</p>
            <label className="grid gap-1 text-xs text-zinc-600">
              送信先（マッチ済みの相手）
              <select
                value={effectiveInviteToUid}
                onChange={(e) => setInviteToUid(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm text-zinc-900"
              >
                {inviteTargets.length === 0 ? <option value="">マッチ相手がいません</option> : null}
                {inviteTargets.map((uid) => (
                  <option key={uid} value={uid}>
                    {peerNames[uid] ?? "読み込み中…"}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-zinc-600">
              候補日時
              <input
                type="datetime-local"
                value={inviteProposedAt}
                onChange={(e) => setInviteProposedAt(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm text-zinc-900"
              />
            </label>
            <label className="grid gap-1 text-xs text-zinc-600">
              場所
              <input
                type="text"
                maxLength={300}
                value={inviteLocation}
                onChange={(e) => setInviteLocation(e.target.value)}
                placeholder="例：渋谷のカフェ"
                className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm text-zinc-900"
              />
            </label>
            <label className="grid gap-1 text-xs text-zinc-600">
              メッセージ（任意）
              <textarea
                rows={3}
                maxLength={500}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="ひとこと添えましょう"
                className="w-full resize-y rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm text-zinc-900"
              />
            </label>
            <button
              type="button"
              disabled={invitePending || !effectiveInviteToUid}
              onClick={() => void handleSend()}
              className="rounded-xl bg-[var(--lobby-red)] px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {invitePending ? "送信中…" : "招待状を送る"}
            </button>
            {inviteNotice ? <p className="text-sm text-amber-800">{inviteNotice}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
