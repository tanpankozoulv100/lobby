"use client";

import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";

export function MatchHistoryHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LobbyBottomSheet open={open} title="マッチング一覧について" onClose={onClose}>
      <div className="space-y-4 pb-4 text-sm leading-relaxed text-zinc-700">
        <p>
          丸アイコンの右下の<strong>キーホルダー色</strong>は、同じ相手とマッチングした回数の目安です。
        </p>
        <ul className="space-y-2 rounded-xl bg-zinc-50 px-4 py-3">
          <li className="flex items-center gap-3">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-amber-950">
              1
            </span>
            <span>黄色 … 1回マッチした相手</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white">
              2
            </span>
            <span>橙色 … 2回マッチした相手</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--lobby-red)] px-1 text-xs font-bold text-white">
              3
            </span>
            <span>赤色 … 3回以上マッチした相手</span>
          </li>
        </ul>
        <p className="text-xs text-zinc-500">
          アイコンをタップすると、相手のプロフィールとあなたとのシンクロ割合（相性質問12問）を確認できます。自由メモは自分だけに表示されます。
        </p>
      </div>
    </LobbyBottomSheet>
  );
}
