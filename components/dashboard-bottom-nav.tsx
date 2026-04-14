"use client";

import Image from "next/image";

/**
 * `Lobby 初期UI.pdf`（アプリ開発/初期UIベース）の主要タブ順に合わせる。
 * ホーム → マッチング履歴 → イベント → お知らせ → チャット → マイページ
 */
export type DashboardTab = "home" | "history" | "event" | "news" | "chat" | "mypage";

const ITEMS: {
  id: DashboardTab;
  label: string;
  icon: string;
  /** 長い正式名（ツールチップ・スクリーンリーダー用） */
  title?: string;
}[] = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "history", label: "履歴", icon: "matching", title: "マッチング履歴" },
  { id: "event", label: "イベント", icon: "event" },
  { id: "news", label: "お知らせ", icon: "news" },
  { id: "chat", label: "チャット", icon: "chat" },
  { id: "mypage", label: "マイページ", icon: "mypage" },
];

type Props = {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

export function DashboardBottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
      aria-label="メインメニュー"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-0.5 pt-1">
        {ITEMS.map(({ id, label, icon, title: navTitle }) => {
          const isOn = active === id;
          const src = isOn
            ? `/assets/nav/${icon}-active.png`
            : `/assets/nav/${icon}.png`;
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                title={navTitle ?? label}
                aria-label={navTitle ?? label}
                className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1 text-[8px] font-medium leading-tight transition-colors hover:bg-zinc-50 sm:text-[9px]"
                aria-current={isOn ? "page" : undefined}
              >
                <Image
                  src={src}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
                />
                <span className={isOn ? "text-[var(--lobby-red)]" : "text-zinc-500"}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
