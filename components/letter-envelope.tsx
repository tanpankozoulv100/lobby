"use client";

import { useState } from "react";

const LETTER_FONT = "var(--font-noto-serif-jp), serif";

/**
 * 受信した手紙の封筒。タップすると封を開け、中から便箋がスライドして出てくる。
 * アニメーション完了後に本文（罫線便箋）を表示する。
 */
export function LetterEnvelope({
  text,
  onOpen,
}: {
  text: string;
  onOpen?: () => void;
}) {
  const [stage, setStage] = useState<"sealed" | "opening" | "open">("sealed");

  if (stage === "open") {
    return (
      <div
        className="lobby-letter-paper lobby-letter-fadein rounded-md border border-[var(--lobby-red)]/15 text-[15px] text-zinc-800 shadow-sm"
        style={{ fontFamily: LETTER_FONT }}
      >
        <p className="whitespace-pre-wrap break-words leading-[2rem]">{text}</p>
      </div>
    );
  }

  const handleOpen = () => {
    if (stage !== "sealed") return;
    onOpen?.();
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setStage(reduce ? "open" : "opening");
  };

  return (
    <div className="flex flex-col items-center gap-2 pt-8">
      <div
        role="button"
        tabIndex={0}
        aria-label="手紙を開封する"
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        data-stage={stage}
        className="lobby-env w-full max-w-sm select-none outline-none"
      >
        <div className="lobby-env-pocket" />
        <div
          className="lobby-env-flap"
          onAnimationEnd={(e) => {
            if (e.animationName === "lobbyEnvFlap") setStage("open");
          }}
        />
        <span className="lobby-env-seal">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 1.8C19 15.7 12 20 12 20z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      {stage === "sealed" ? (
        <span className="text-xs font-medium text-[var(--lobby-red)]">タップして開封する</span>
      ) : null}
    </div>
  );
}
