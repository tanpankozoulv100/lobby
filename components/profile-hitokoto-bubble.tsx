"use client";

import { truncateHitokoto } from "@/lib/hitokoto";

type Props = {
  text?: string | null;
  /** 吹き出しのしっぽの向き（bottom: アイコンの上に置く / left: アイコンの右に置く） */
  tail?: "bottom" | "left";
  className?: string;
};

/** プロフィールの「ひとこと」(bio) を吹き出しで表示。空なら何も出さない。 */
export function ProfileHitokotoBubble({ text, tail = "bottom", className = "" }: Props) {
  const value = truncateHitokoto(text);
  if (!value) return null;

  return (
    <span
      className={`relative inline-block max-w-full rounded-2xl border border-zinc-200 bg-white px-2.5 py-1 text-[11px] leading-snug text-zinc-700 shadow-sm ${className}`}
    >
      <span className="block truncate">{value}</span>
      {tail === "bottom" ? (
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-zinc-200 bg-white" />
      ) : (
        <span className="absolute right-full top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rotate-45 border-b border-l border-zinc-200 bg-white" />
      )}
    </span>
  );
}
