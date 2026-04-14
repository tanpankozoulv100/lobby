"use client";

import QRCode from "react-qr-code";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 連携用 6 文字コード（QR に埋め込む） */
  connectionCode: string;
  displayName: string;
  participantSerial: string;
  seasonCardTitle: string;
  seasonDateLabel: string;
};

export function LobbyQrModal({
  open,
  onClose,
  connectionCode,
  displayName,
  participantSerial,
  seasonCardTitle,
  seasonDateLabel,
}: Props) {
  if (!open) return null;

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
        <p className="mt-6 text-center text-lg font-bold text-[var(--lobby-red)]">{displayName}</p>
        <p className="mt-1 text-center text-sm text-[var(--lobby-red)]">{participantSerial}</p>
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
