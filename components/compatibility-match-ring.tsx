"use client";

type CompatibilityMatchRingProps = {
  percent: number;
  /** リング下の補足（例: 6問一致） */
  caption?: string;
  size?: number;
  className?: string;
};

/** 相性パーセントの円形インジケータ（デザイン: 赤アーク＋白トラック） */
export function CompatibilityMatchRing({
  percent,
  caption,
  size = 72,
  className = "",
}: CompatibilityMatchRingProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-zinc-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-[var(--lobby-red)] transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[var(--lobby-red)]"
          aria-label={`相性 ${clamped}%`}
        >
          {clamped}%
        </span>
      </div>
      {caption ? <span className="text-[10px] text-zinc-500">{caption}</span> : null}
    </div>
  );
}
