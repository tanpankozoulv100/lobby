"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** ヘッダー行（閉じる + タイトル）のおおよその高さ */
const SHEET_HEADER_HEIGHT = "3.25rem";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 相性質問など長いフォーム用（パネル高を画面いっぱいに近づける） */
  tall?: boolean;
};

/** iOS Safari では body を position:fixed にすると <select> 後に画面がずれるため overflow のみ */
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const { documentElement: html, body } = document;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [active]);
}

export function LobbyBottomSheet({ open, title, onClose, children, tall }: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const panelMaxHeight = tall ? "92dvh" : "85dvh";
  const scrollMaxHeight = `calc(${panelMaxHeight} - ${SHEET_HEADER_HEIGHT})`;

  useBodyScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-black/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex w-full max-w-[100vw] flex-col overflow-hidden rounded-t-3xl bg-[var(--lobby-cream)] shadow-2xl"
        style={{ maxHeight: panelMaxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-[3.25rem] shrink-0 items-center gap-2 border-b border-zinc-200/80 px-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl font-light leading-none text-zinc-600"
            aria-label="閉じる"
          >
            ×
          </button>
          <h2 id={titleId} className="flex-1 truncate text-center text-base font-semibold text-zinc-900">
            {title}
          </h2>
          <span className="w-8 shrink-0" aria-hidden />
        </div>
        <div
          className="overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          style={{
            maxHeight: scrollMaxHeight,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
