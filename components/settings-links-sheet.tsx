"use client";

import { useState } from "react";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";
import { LOBBY_SETTINGS_LINKS, type LobbySettingsLinkItem } from "@/lib/lobby-settings-links";

function SettingsLinkRow({
  item,
  onSelect,
}: {
  item: LobbySettingsLinkItem;
  onSelect: (item: LobbySettingsLinkItem) => void;
}) {
  const className =
    "flex w-full items-center gap-3 border-b border-zinc-200/60 py-4 text-left last:border-b-0";

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span className="flex-1 text-sm font-medium text-zinc-900">{item.label}</span>
        <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </a>
    );
  }

  return (
    <button type="button" onClick={() => onSelect(item)} className={className}>
      <span className="flex-1 text-sm font-medium text-zinc-900">{item.label}</span>
      <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function SettingsLinksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [detail, setDetail] = useState<LobbySettingsLinkItem | null>(null);

  return (
    <>
      <LobbyBottomSheet
        open={open && !detail}
        title="各種設定"
        onClose={() => {
          setDetail(null);
          onClose();
        }}
      >
        <nav className="-mx-1 pb-2">
          {LOBBY_SETTINGS_LINKS.map((item) => (
            <SettingsLinkRow key={item.id} item={item} onSelect={setDetail} />
          ))}
        </nav>
      </LobbyBottomSheet>

      <LobbyBottomSheet
        open={!!detail}
        title={detail?.label ?? ""}
        onClose={() => setDetail(null)}
      >
        <p className="pb-4 text-sm leading-relaxed text-zinc-700">{detail?.fallbackMessage}</p>
      </LobbyBottomSheet>
    </>
  );
}
