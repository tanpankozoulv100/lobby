"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { ChatPeerEntry } from "@/lib/firestore-chat-date";
import {
  chatThreadId,
  markChatThreadRead,
  pickLetters,
  subscribeChatMessages,
  type ChatMessageRow,
} from "@/lib/firestore-chat";

const LETTER_FONT = "var(--font-a1), sans-serif";

type LetterKind = "mine" | "peer";

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

/** Lobby ロゴ（封蝋の中身） */
function SealMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 1.8C19 15.7 12 20 12 20z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 封筒イラスト（クリックでリーダーを開く／空なら点線） */
function EnvelopeSlot({
  kind,
  filled,
  label,
  onOpen,
}: {
  kind: LetterKind;
  filled: boolean;
  label: string;
  onOpen?: () => void;
}) {
  if (!filled) {
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <div className={`lobby-letterbox lobby-letterbox--${kind} lobby-letterbox--empty`}>
          <span className="lobby-letterbox-flap" aria-hidden />
          <span className="lobby-letterbox-empty-label">{label}</span>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="lobby-letterbox-btn flex-col items-center gap-2">
      <span className={`lobby-letterbox lobby-letterbox--${kind}`}>
        <span className="lobby-letterbox-flap" aria-hidden />
        <span className="lobby-letterbox-seal" aria-hidden>
          <SealMark />
        </span>
      </span>
      <span className="text-xs font-medium text-[var(--lobby-red)]">タップして開封する</span>
    </button>
  );
}

/** 封筒を開く → 二つ折りから便箋が画面いっぱいに開く全画面リーダー */
function LetterReader({
  kind,
  title,
  text,
  dateLabel,
  onClose,
}: {
  kind: LetterKind;
  title: string;
  text: string;
  dateLabel: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"envelope" | "opening" | "paper">("envelope");

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStage("paper");
      return;
    }
    const t = window.setTimeout(() => setStage("opening"), 140);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="lobby-letter-reader">
      <header className="flex shrink-0 items-center gap-2 bg-[var(--lobby-red)] px-3 py-3 text-white">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-light"
          aria-label="閉じる"
        >
          ×
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-medium">{title}</p>
        <span className="h-9 w-9" />
      </header>

      {stage !== "paper" ? (
        <div className="lobby-letter-reader-stage">
          <div
            className={`lobby-letterbox lobby-letterbox--${kind} ${stage === "opening" ? "is-opening" : ""}`}
            onAnimationEnd={(e) => {
              if (e.animationName === "lobbyBoxFlap") setStage("paper");
            }}
          >
            <span className="lobby-letterbox-flap" aria-hidden />
            <span className="lobby-letterbox-seal" aria-hidden>
              <SealMark />
            </span>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div
            className="lobby-letter-unfold lobby-letter-paper mx-auto max-w-md rounded-md border border-[var(--lobby-red)]/15 text-[15px] text-zinc-800 shadow-sm"
            style={{ fontFamily: LETTER_FONT }}
          >
            <p className="whitespace-pre-wrap break-words leading-[2rem]">{text}</p>
          </div>
          {dateLabel ? (
            <p className="mx-auto mt-2 max-w-md text-right text-[11px] text-zinc-400">{dateLabel}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function LetterExchangeView({
  user,
  peer,
  peerDisplayName,
  onBack,
}: {
  user: User;
  peer: ChatPeerEntry;
  peerDisplayName: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessageRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reading, setReading] = useState<LetterKind | null>(null);

  const threadId = chatThreadId(user.uid, peer.uid);

  const { mine: myLetter, peer: peerLetter } = useMemo(
    () => pickLetters(messages ?? [], user.uid, peer.uid),
    [messages, user.uid, peer.uid]
  );

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

  // 受信レターを開いたら既読を記録
  useEffect(() => {
    if (reading === "peer" && peerLetter) void markChatThreadRead(user.uid, peer.uid);
  }, [reading, peerLetter, user.uid, peer.uid]);

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
        <p className="min-w-0 flex-1 text-center text-sm font-medium">{peerDisplayName}さんとの手紙</p>
        <span className="h-9 w-9" />
      </header>

      {loadError ? (
        <p className="px-4 py-5 text-sm text-amber-800">{loadError}</p>
      ) : messages === null ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">読み込み中…</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-8">
            <section className="flex w-full flex-col items-center gap-2">
              <p className="text-xs font-semibold text-zinc-500">{peerDisplayName}さんからの手紙</p>
              <EnvelopeSlot
                kind="peer"
                filled={!!peerLetter}
                label="まだ届いていません"
                onOpen={() => setReading("peer")}
              />
            </section>

            <section className="flex w-full flex-col items-center gap-2">
              <p className="text-xs font-semibold text-zinc-500">あなたが送った手紙</p>
              <EnvelopeSlot
                kind="mine"
                filled={!!myLetter}
                label="まだ送っていません"
                onOpen={() => setReading("mine")}
              />
            </section>
          </div>
        </div>
      )}

      {reading === "peer" && peerLetter ? (
        <LetterReader
          kind="peer"
          title={`${peerDisplayName}さんからの手紙`}
          text={peerLetter.text}
          dateLabel={formatLetterDate(peerLetter.createdAt)}
          onClose={() => setReading(null)}
        />
      ) : null}
      {reading === "mine" && myLetter ? (
        <LetterReader
          kind="mine"
          title="あなたが送った手紙"
          text={myLetter.text}
          dateLabel={formatLetterDate(myLetter.createdAt)}
          onClose={() => setReading(null)}
        />
      ) : null}
    </div>
  );
}
