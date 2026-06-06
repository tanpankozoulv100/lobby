"use client";

import Image from "next/image";

/** 左から: 履歴 → イベント → ホーム（中央・やや大）→ チャット → マイページ */
export type DashboardTab = "home" | "history" | "event" | "chat" | "mypage";

const ITEMS: {
  id: DashboardTab;
  label: string;
  icon: string;
  title?: string;
  isHome?: boolean;
}[] = [
  { id: "history", label: "履歴", icon: "matching", title: "マッチング履歴" },
  { id: "event", label: "イベント", icon: "event" },
  { id: "home", label: "ホーム", icon: "home", isHome: true },
  { id: "chat", label: "レター", icon: "chat" },
  { id: "mypage", label: "マイページ", icon: "mypage" },
];

type Props = {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  /** ホームタブ用: 未読のお知らせがあるとき true */
  homeHasUnread?: boolean;
};

export function DashboardBottomNav({ active, onChange, homeHasUnread = false }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200/80 bg-[var(--lobby-cream)] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
      aria-label="メインメニュー"
    >
      <ul className="mx-auto flex max-w-lg items-end justify-between gap-0 px-1 pt-1.5">
        {ITEMS.map(({ id, label, icon, title: navTitle, isHome }) => {
          const isOn = active === id;
          const src = isOn ? `/assets/nav/${icon}-active.png` : `/assets/nav/${icon}.png`;
          const iconClass = isHome
            ? "h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
            : "h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9";
          const showDot = isHome && homeHasUnread;

          return (
            <li key={id} className={`min-w-0 ${isHome ? "flex-[1.12]" : "flex-1"}`}>
              <button
                type="button"
                onClick={() => onChange(id)}
                title={navTitle ?? label}
                aria-label={
                  showDot ? `${navTitle ?? label}（新しいお知らせあり）` : (navTitle ?? label)
                }
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-medium leading-tight transition-colors hover:bg-[var(--lobby-red)]/5 sm:text-[10px] ${
                  isHome ? "-mt-1 pb-0.5" : ""
                }`}
                aria-current={isOn ? "page" : undefined}
              >
                <span className="relative">
                  <Image src={src} alt="" width={44} height={44} className={iconClass} />
                  {showDot ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--lobby-cream)]"
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className={isOn ? "text-[var(--lobby-red)]" : "text-zinc-500"}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
