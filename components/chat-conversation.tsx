"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { ChatPeerEntry } from "@/lib/firestore-chat-date";
import {
  chatThreadId,
  chatTimestampMs,
  markChatThreadRead,
  pickLetters,
  sendChatMessage,
  subscribeChatMessages,
  subscribeChatThreadRead,
  LETTER_MAX_LENGTH,
  type ChatMessageRow,
} from "@/lib/firestore-chat";
import { ChatSettingsSheet } from "@/components/chat-settings-sheet";
import { LetterEnvelope } from "@/components/letter-envelope";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import type { CompatibilityAnswers } from "@/lib/compatibility-questions";

const LETTER_FONT = "var(--font-noto-serif-jp), serif";

function formatLetterDate(ts: unknown): string {
  if (
    ts &&
    typeof ts === "object" &&
    "toDate" in ts &&
    typeof (ts as { toDate: () => Date }).toDate === "function"
  ) {
    return (ts as { toDate: () => Date }).toDate().toLocaleString("ja-JP", {
      year: "numeric",
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
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}まで`;
}

/** 罫線つき便箋の読み取り表示 */
function LetterSheet({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={`lobby-letter-paper rounded-md border border-[var(--lobby-red)]/15 text-[15px] text-zinc-800 shadow-sm ${className ?? ""}`}
      style={{ fontFamily: LETTER_FONT }}
    >
      <p className="whitespace-pre-wrap break-words leading-[2rem]">{text}</p>
    </div>
  );
}

export function ChatConversation({
  user,
  peer,
  peerDisplayName,
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
  const [peerOpened, setPeerOpened] = useState(false);
  // "idle" | "folding"（送信アニメ再生中）
  const [phase, setPhase] = useState<"idle" | "folding">("idle");

  const threadId = chatThreadId(user.uid, peer.uid);

  const { mine: myLetter, peer: peerLetter } = useMemo(
    () => pickLetters(messages ?? [], user.uid, peer.uid),
    [messages, user.uid, peer.uid]
  );

  // 相手が自分の手紙を開封したか
  const peerOpenedMine = useMemo(() => {
    if (!myLetter || peerLastReadMs == null) return false;
    const ms = chatTimestampMs(myLetter.createdAt);
    return ms != null && ms <= peerLastReadMs;
  }, [myLetter, peerLastReadMs]);

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

  // 相手の開封時刻を購読
  useEffect(() => {
    const unsub = subscribeChatThreadRead(user.uid, peer.uid, (s) =>
      setPeerLastReadMs(s.peerLastReadMs)
    );
    return () => unsub?.();
  }, [user.uid, peer.uid]);

  // 相手の手紙を開封したら既読を記録
  useEffect(() => {
    if (peerOpened && peerLetter) void markChatThreadRead(user.uid, peer.uid);
  }, [peerOpened, peerLetter, user.uid, peer.uid]);

  // 送信アニメーション完了後に実際に送信する
  const runSend = useCallback(async () => {
    setSending(true);
    const res = await sendChatMessage(user.uid, peer.uid, draft);
    setSending(false);
    setPhase("idle");
    if (res.ok) setDraft("");
    else setSendError(res.message);
  }, [user.uid, peer.uid, draft]);

  const handleSendClick = useCallback(() => {
    if (!canSend || sending || phase !== "idle") return;
    if (!draft.trim()) {
      setSendError("手紙の本文を書いてください。");
      return;
    }
    setSendError(null);
    setPhase("folding"); // 折りたたみアニメ開始 → onAnimationEnd で送信
  }, [canSend, sending, phase, draft]);

  const remaining = LETTER_MAX_LENGTH - draft.length;
  const showComposer = canSend && !myLetter;

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
          {isStaff
            ? "運営レター"
            : myLetter
              ? "送信済みの手紙"
              : canSend
                ? formatDeadlineBanner(peer.expiresAt)
                : "送信期限切れ"}
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

      <div className="flex min-h-0 flex-1 flex-col" aria-live="polite">
        {loadError ? (
          <p className="px-4 py-5 text-sm text-amber-800">{loadError}</p>
        ) : messages === null ? (
          <p className="px-4 py-5 text-center text-sm text-zinc-500">読み込み中…</p>
        ) : showComposer ? (
          /* 作成画面：便箋を画面いっぱいに表示して 1 行目から書く */
          <>
            {peerLetter ? (
              <div className="shrink-0 px-4 pt-4">
                <p className="mb-2 text-xs font-semibold text-zinc-500">
                  {peerDisplayName}さんからの手紙
                </p>
                <LetterEnvelope text={peerLetter.text} onOpen={() => setPeerOpened(true)} />
              </div>
            ) : null}
            <div className="shrink-0 px-4 pb-1 pt-3">
              <p className="text-xs font-semibold text-zinc-500">
                {peerLetter ? "お返事を書く" : "手紙を書く"}（1マッチにつき1通）
              </p>
            </div>
            <div className="relative min-h-0 flex-1 px-4 pb-3">
              {phase === "folding" ? (
                <div
                  className="lobby-fold"
                  onAnimationEnd={(e) => {
                    if (e.animationName === "lobbyFoldDrop") void runSend();
                  }}
                >
                  <div className="lobby-fold-half lobby-fold-top">
                    <div
                      className="lobby-fold-sheet lobby-letter-paper text-[15px] text-zinc-800"
                      style={{ fontFamily: LETTER_FONT }}
                    >
                      <p className="whitespace-pre-wrap break-words leading-[2rem]">{draft}</p>
                    </div>
                  </div>
                  <div className="lobby-fold-half lobby-fold-bottom">
                    <div
                      className="lobby-fold-sheet lobby-letter-paper text-[15px] text-zinc-800"
                      style={{ fontFamily: LETTER_FONT }}
                    >
                      <p className="whitespace-pre-wrap break-words leading-[2rem]">{draft}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <textarea
                  value={draft}
                  maxLength={LETTER_MAX_LENGTH}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="ここに手紙を書きましょう…"
                  className="lobby-letter-paper h-full w-full resize-none rounded-md border border-[var(--lobby-red)]/15 text-[15px] text-zinc-800 shadow-sm outline-none focus:border-[var(--lobby-red)]/40 focus:ring-1 focus:ring-[var(--lobby-red)]/20"
                  style={{ fontFamily: LETTER_FONT }}
                />
              )}
            </div>
            <div className="shrink-0 border-t border-zinc-200/70 bg-[var(--lobby-cream)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-[11px] ${remaining < 0 ? "text-amber-700" : "text-zinc-400"}`}>
                  残り{remaining}文字
                </span>
                <button
                  type="button"
                  disabled={sending || phase !== "idle" || !draft.trim()}
                  onClick={handleSendClick}
                  className="flex items-center gap-2 rounded-full bg-[var(--lobby-red)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-40"
                >
                  {phase === "folding" || sending ? "投函中…" : "折りたたんで送る"}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12l14-7-4 14-3-5-2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {sendError ? <p className="mt-1 text-xs text-amber-800">{sendError}</p> : null}
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                送ると折りたたんで相手に届きます。手紙は1マッチにつき1通だけ送れます。
              </p>
            </div>
          </>
        ) : (
          /* 送信済み・閲覧のみ：手紙をセクションで表示 */
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="mx-auto flex max-w-md flex-col gap-6">
              {peerLetter ? (
                <section className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-zinc-500">
                    {peerDisplayName}さんからの手紙
                  </p>
                  <LetterEnvelope text={peerLetter.text} onOpen={() => setPeerOpened(true)} />
                  {peerOpened ? (
                    <p className="text-right text-[11px] text-zinc-400">
                      {formatLetterDate(peerLetter.createdAt)}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {myLetter ? (
                <section className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-zinc-500">あなたが送った手紙</p>
                  <LetterSheet text={myLetter.text} className="opacity-95" />
                  <p className="text-right text-[11px] text-zinc-400">
                    {formatLetterDate(myLetter.createdAt)}
                    <span className="ml-2 text-[var(--lobby-red)]">
                      {peerOpenedMine ? "相手が開封しました" : "未開封"}
                    </span>
                  </p>
                </section>
              ) : null}

              {myLetter && !peerLetter ? (
                <p className="rounded-md bg-[var(--lobby-surface-raised)] px-4 py-3 text-center text-xs leading-relaxed text-zinc-600">
                  手紙を送りました。{peerDisplayName}さんからのお返事を待ちましょう。
                </p>
              ) : null}

              {!canSend && !myLetter ? (
                <p className="rounded-md bg-[var(--lobby-surface-raised)] px-4 py-3 text-center text-xs leading-relaxed text-zinc-600">
                  送信期限が過ぎたため、この相手へは手紙を送れません。再マッチで続きから送れます。
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

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
