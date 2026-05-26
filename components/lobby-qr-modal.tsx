"use client";

import QRCode from "react-qr-code";
import { formatConnectionCodeDisplay } from "@/lib/connection-code-display";

type Props = {
  open: boolean;
  onClose: () => void;
  connectionCode: string;
  displayName: string;
  seasonCardTitle: string;
  seasonDateLabel: string;
};

export function LobbyQrModal({
  open,
  onClose,
  connectionCode,
  displayName,
  seasonCardTitle,
  seasonDateLabel,
}: Props) {
  if (!open || !connectionCode) return null;

  const payload = `LOBBY:${connectionCode}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/45 px-4 pt-[env(safe-area-inset-top)] pb-8"
      role="dialog"
      aria-modal="true"
      aria-label="QRコード表示"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[var(--lobby-cream)] px-6 pb-8 pt-8 shadow-xl">
        <div className="text-center">
          <p className="font-serif text-3xl font-semibold tracking-tight text-[var(--lobby-red)]">Lobby</p>
          <p className="mt-2 text-sm font-medium text-[var(--lobby-red)]">{seasonCardTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--lobby-red)]/90">{seasonDateLabel}</p>
        </div>
        <div className="mx-auto mt-6 flex h-52 w-52 items-center justify-center rounded-xl bg-white p-3 shadow-inner">
          <QRCode value={payload} size={200} level="M" className="h-full w-full" />
        </div>
        <p className="mt-4 text-center text-xs font-medium text-zinc-600">マッチングコード</p>
        <p className="mt-1 text-center font-mono text-2xl font-bold tracking-[0.15em] text-[var(--lobby-red)]">
          {formatConnectionCodeDisplay(connectionCode)}
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-zinc-500">
          再マッチするときは、相手にこの QR を読み取ってもらってください。
        </p>
        <p className="mt-6 text-center text-lg font-bold text-[var(--lobby-red)]">{displayName}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-light text-zinc-800 shadow-md"
        aria-label="閉じる"
      >
        ✕
      </button>
    </div>
  );
}
