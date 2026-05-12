"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigComplete } from "@/lib/firebase";
import { createBoardPost, subscribeBoardPosts, type BoardPostRow } from "@/lib/firestore-board";
import { subscribeOutboundLinks } from "@/lib/firestore-connections";
import {
  ensureDateInviteTicketsByMatchCount,
  sendDateInvite,
  subscribeActiveChatPeers,
  subscribeActiveDateInviteTickets,
  type ActiveDateInviteTicket,
} from "@/lib/firestore-chat-date";

function formatPostTime(ts: unknown) {
  if (
    ts &&
    typeof ts === "object" &&
    "toDate" in ts &&
    typeof (ts as { toDate: () => Date }).toDate === "function"
  ) {
    return (ts as { toDate: () => Date }).toDate().toLocaleString("ja-JP", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  return "";
}

function BoardConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">参加者掲示板</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        接続できませんでした。しばらく経ってからお試しください。
      </p>
    </section>
  );
}

function DashboardBoardLoaded({ user }: { user: User }) {
  const [posts, setPosts] = useState<BoardPostRow[] | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [postPending, setPostPending] = useState(false);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [activePeers, setActivePeers] = useState<{ uid: string; expiresAt: Date }[]>([]);
  const [matchedPeerUids, setMatchedPeerUids] = useState<string[]>([]);
  const [ticketRows, setTicketRows] = useState<ActiveDateInviteTicket[]>([]);
  const [inviteToUid, setInviteToUid] = useState("");
  const [inviteLocation, setInviteLocation] = useState("");
  const [inviteProposedAt, setInviteProposedAt] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;
    void (async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const d = snap.data();
      const name = d && typeof d.displayName === "string" ? d.displayName.trim() : "";
      setAuthorName(name || (user.email?.split("@")[0] ?? "参加者"));
    })();
  }, [user.uid, user.email]);

  useEffect(() => {
    const unsub = subscribeBoardPosts(
      (rows) => {
        setPosts(rows);
      },
      () => {
        setPosts([]);
      }
    );
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const unsubActive = subscribeActiveChatPeers(
      user.uid,
      (rows) => {
        setActivePeers(rows.map((r) => ({ uid: r.uid, expiresAt: r.expiresAt })));
        setInviteToUid((prev) => {
          if (prev && rows.some((r) => r.uid === prev)) return prev;
          return rows[0]?.uid ?? "";
        });
      },
      () => {
        setActivePeers([]);
      }
    );
    const unsubTickets = subscribeActiveDateInviteTickets(
      user.uid,
      (rows) => setTicketRows(rows),
      () => setTicketRows([])
    );
    const unsubMatches = subscribeOutboundLinks(user.uid, (rows) => {
      const peerUids = rows.map((r) => r.peerUid).sort();
      setMatchedPeerUids(peerUids);
      setInviteToUid((prev) => (prev && peerUids.includes(prev) ? prev : (peerUids[0] ?? "")));
      void ensureDateInviteTicketsByMatchCount(user.uid, rows.length);
    });
    return () => {
      unsubActive?.();
      unsubTickets?.();
      unsubMatches?.();
    };
  }, [user.uid]);

  const handlePost = useCallback(async () => {
    setPostMessage(null);
    setPostPending(true);
    const result = await createBoardPost(user.uid, authorName, body);
    setPostPending(false);
    if (result.ok) {
      setPostMessage("投稿しました。");
      setBody("");
    } else {
      setPostMessage(result.message);
    }
  }, [user.uid, authorName, body]);

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
      toUid: inviteToUid,
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
    } else {
      setInviteNotice(result.message);
    }
  }, [user.uid, inviteToUid, inviteLocation, inviteProposedAt, inviteMessage]);

  const chatUnlocked = activePeers.length > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">チャット</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        QRでマッチした相手とのチャットは通常24時間、シーズン最終日マッチは72時間解放されます（タブは常時表示）。
      </p>
      <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          {chatUnlocked ? "チャット解放中" : "チャット未解放"}
        </p>
        {chatUnlocked ? (
          <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
            {activePeers.map((peer) => (
              <li key={peer.uid} className="break-all">
                相手: {peer.uid} / 期限: {peer.expiresAt.toLocaleString("ja-JP")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-zinc-600 dark:text-zinc-300">
            会場でQR交換してマッチすると、相手とのチャットが24時間開放されます。
          </p>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {chatUnlocked ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
            <label htmlFor="board-author" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              表示名（プロフィールの表示名を初期値にしています）
            </label>
            <input
              id="board-author"
              type="text"
              maxLength={50}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <label htmlFor="board-body" className="mt-3 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              本文（500文字以内）
            </label>
            <textarea
              id="board-body"
              rows={3}
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">{body.length} / 500</span>
              <button
                type="button"
                disabled={postPending}
                onClick={() => void handlePost()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {postPending ? "送信中…" : "投稿する"}
              </button>
            </div>
            {postMessage ? (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{postMessage}</p>
            ) : null}
          </div>
        ) : null}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">デートお誘い券</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            10マッチごとに1枚付与され、有効期限は72時間です。
          </p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">利用可能: {ticketRows.length} 枚</p>
          {ticketRows.length > 0 ? (
            <p className="text-xs text-zinc-500">
              最短期限: {ticketRows[0]!.expiresAt.toLocaleString("ja-JP")}
            </p>
          ) : null}
          <div className="mt-3 grid gap-2">
            <select
              value={inviteToUid}
              onChange={(e) => setInviteToUid(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">送信先（マッチ済み相手）を選択</option>
              {matchedPeerUids.map((uid) => (
                <option key={uid} value={uid}>
                  {uid}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={inviteProposedAt}
              onChange={(e) => setInviteProposedAt(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <input
              type="text"
              maxLength={300}
              value={inviteLocation}
              onChange={(e) => setInviteLocation(e.target.value)}
              placeholder="場所"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <textarea
              rows={2}
              maxLength={500}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="メッセージ（任意）"
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              disabled={invitePending || !inviteToUid || ticketRows.length === 0}
              onClick={() => void handleSendDateInvite()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              {invitePending ? "送信中…" : "お誘い券を送る"}
            </button>
          </div>
          {inviteNotice ? <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{inviteNotice}</p> : null}
        </div>
        {chatUnlocked ? (
          <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">最近の投稿</p>
          {posts === null ? (
            <p className="mt-2 text-sm text-zinc-500">読み込み中…</p>
          ) : posts.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">まだ投稿がありません。</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{p.authorDisplayName}</span>
                    <span className="text-xs text-zinc-500">{formatPostTime(p.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{p.body}</p>
                </li>
              ))}
            </ul>
          )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardBoardSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <BoardConfigMissing />;
  }
  return <DashboardBoardLoaded user={user} />;
}
