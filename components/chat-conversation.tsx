"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { ChatPeerEntry } from "@/lib/firestore-chat-date";
import {
  chatThreadId,
  chatTimestampMs,
  markChatThreadRead,
  sendChatMessage,
  subscribeChatMessages,
  subscribeChatThreadRead,
  type ChatMessageRow,
} from "@/lib/firestore-chat";
import { ChatSettingsSheet } from "@/components/chat-settings-sheet";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import { ProfileAvatarCircle } from "@/components/profile-avatar-circle";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";

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

function formatDeadlineBanner(d: Date): string {
  return `期限：${d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}まで`;
}

function messageDateKey(ts: unknown): string | null {
  if (
    ts &&
    typeof ts === "object" &&
    "toDate" in ts &&
    typeof (ts as { toDate: () => Date }).toDate === "function"
  ) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
  }
  return null;
}

function groupMessagesWithDates(
  messages: ChatMessageRow[]
): ({ type: "date"; label: string } | { type: "msg"; msg: ChatMessageRow })[] {
  const out: ({ type: "date"; label: string } | { type: "msg"; msg: ChatMessageRow })[] = [];
  let lastDate: string | null = null;
  for (const msg of messages) {
    const dk = messageDateKey(msg.createdAt);
    if (dk && dk !== lastDate) {
      out.push({ type: "date", label: dk });
      lastDate = dk;
    }
    out.push({ type: "msg", msg });
  }
  return out;
}

export function ChatConversation({
  user,
  peer,
  peerDisplayName,
  peerAvatarPath,
  myDisplayName,
  myAvatarPath,
  isStaff,
  canSend,
  myAnswers,
  onOpenPeerProfile,
  onBack,
}: {
  user: User;
  peer: ChatPeerEntry;
  peerDisplayName: string;
  peerAvatarPath?: string;
  myDisplayName: string;
  myAvatarPath?: string;
  isStaff: boolean;
  canSend: boolean;
  myAnswers?: CompatibilityAnswers;
  onOpenPeerProfile: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessageRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [peerLastReadMs, setPeerLastReadMs] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadId = chatThreadId(user.uid, peer.uid);
  const timeline = useMemo(
    () => (messages && messages.length > 0 ? groupMessagesWithDates(messages) : []),
    [messages]
  );

  // 相手が読んだ自分の最新メッセージにだけ「既読」を出す
  const lastReadMineId = useMemo(() => {
    if (!messages || peerLastReadMs == null) return null;
    let id: string | null = null;
    for (const m of messages) {
      if (m.senderUid !== user.uid) continue;
      const ms = chatTimestampMs(m.createdAt);
      if (ms != null && ms <= peerLastReadMs) id = m.id;
    }
    return id;
  }, [messages, peerLastReadMs, user.uid]);

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

  // 相手の既読時刻を購読
  useEffect(() => {
    const unsub = subscribeChatThreadRead(user.uid, peer.uid, (s) =>
      setPeerLastReadMs(s.peerLastReadMs)
    );
    return () => unsub?.();
  }, [user.uid, peer.uid]);

  // この会話を開いている／新着が届いたら自分の既読を記録
  useEffect(() => {
    if (!messages) return;
    void markChatThreadRead(user.uid, peer.uid);
  }, [user.uid, peer.uid, messages]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSendError(null);
    setSending(true);
    const res = await sendChatMessage(user.uid, peer.uid, draft);
    setSending(false);
    if (res.ok) setDraft("");
    else setSendError(res.message);
  }, [user.uid, peer.uid, draft, canSend]);

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex flex-col bg-[var(--lobby-cream)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-2 bg-[var(--lobby-red)] px-3 py-3 text-white">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-light"
          aria-label="閉じる"
        >
          ×
        </button>
        <p className="min-w-0 flex-1 text-center text-xs font-medium leading-snug sm:text-sm">
          {isStaff ? "運営レター（期限なし）" : canSend ? formatDeadlineBanner(peer.expiresAt) : "期限切れ・履歴のみ"}
        </p>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-lg"
          aria-label="設定"
        >
          <span className="block h-0.5 w-5 rounded-full bg-white" />
          <span className="block h-0.5 w-5 rounded-full bg-white" />
          <span className="block h-0.5 w-5 rounded-full bg-white" />
        </button>
      </header>

      {!isStaff ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-zinc-200/80 bg-[var(--lobby-surface-raised)] px-4 py-2.5">
          <span className="truncate text-sm font-semibold text-zinc-900">{peerDisplayName}</span>
          <MatchCompatibilityInline peerUid={peer.uid} myAnswers={myAnswers} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-live="polite">
        {loadError ? (
          <p className="text-sm text-amber-800">{loadError}</p>
        ) : messages === null ? (
          <p className="text-center text-sm text-zinc-500">読み込み中…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">まだメッセージがありません。最初の一言を送ってみましょう。</p>
        ) : (
          <div className="space-y-3">
            {timeline.map((item, i) => {
              if (item.type === "date") {
                return (
                  <div key={`d-${item.label}-${i}`} className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-zinc-300/80" />
                    <span className="shrink-0 text-[11px] text-zinc-500">{item.label}</span>
                    <span className="h-px flex-1 bg-zinc-300/80" />
                  </div>
                );
              }
              const m = item.msg;
              const mine = m.senderUid === user.uid;
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                  <ProfileAvatarCircle
                    displayName={mine ? myDisplayName : peerDisplayName}
                    avatarPath={mine ? myAvatarPath : peerAvatarPath}
                    className="mt-1 h-8 w-8 text-xs"
                  />
                  <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "rounded-br-sm border border-[var(--lobby-red)]/10 bg-[var(--lobby-surface-raised)] text-zinc-900"
                          : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                    <p className={`mt-1 flex items-center gap-1 text-[10px] text-zinc-500 ${mine ? "justify-end" : ""}`}>
                      {formatMessageTime(m.createdAt)}
                      {mine && m.id === lastReadMineId ? (
                        <span className="text-[var(--lobby-red)]">既読</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!canSend ? (
        <p className="shrink-0 border-t border-zinc-200/80 bg-[var(--lobby-surface-raised)] px-4 py-3 text-center text-xs leading-relaxed text-zinc-600">
          送信期限が過ぎています。履歴は閲覧できます。再マッチで続きから送れます。
        </p>
      ) : (
        <div className="shrink-0 border-t border-zinc-200/80 bg-[var(--lobby-cream)] px-3 py-2">
          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400"
              aria-label="画像（準備中）"
              title="準備中"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="9" cy="10" r="1.5" fill="currentColor" />
                <path d="M4 16l4-4 4 4 4-5 4 5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
              </svg>
            </button>
            <textarea
              rows={1}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="メッセージを入力"
              className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--lobby-red)] focus:ring-1 focus:ring-[var(--lobby-red)]/30"
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lobby-red)] text-white disabled:opacity-40"
              aria-label="送信"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12l14-7-4 14-3-5-2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {sendError ? <p className="mt-1 text-xs text-amber-800">{sendError}</p> : null}
        </div>
      )}

      <ChatSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        myUid={user.uid}
        peerUid={peer.uid}
        peerDisplayName={peerDisplayName}
        onOpenPeerProfile={onOpenPeerProfile}
      />
    </div>
  );
}
