"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function LobbyBottomSheet({ open, title, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85dvh] w-full overflow-hidden rounded-t-3xl bg-[var(--lobby-cream)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200/80 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl font-light leading-none text-zinc-600"
            aria-label="閉じる"
          >
            ×
          </button>
          <h2 className="flex-1 text-center text-base font-semibold text-zinc-900">{title}</h2>
          <span className="w-8" aria-hidden />
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
