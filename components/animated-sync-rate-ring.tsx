"use client";

import { useEffect, useState } from "react";

type Props = {
  /** 目標パーセント 0–100 */
  targetPercent: number;
  size?: number;
  /** シートを開いたときだけアニメーション */
  animateKey: string | number;
  caption?: string;
};

/** シンクロ％ — 数字と円弧が 0 から目標値まで伸びる */
export function AnimatedSyncRateRing({
  targetPercent,
  size = 160,
  animateKey,
  caption,
}: Props) {
  const clampedTarget = Math.min(100, Math.max(0, targetPercent));
  const [displayPercent, setDisplayPercent] = useState(0);

  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - displayPercent / 100);

  useEffect(() => {
    setDisplayPercent(0);
    const durationMs = 900;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplayPercent(Math.round(clampedTarget * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animateKey, clampedTarget]);

  return (
    <div className="flex flex-col items-center gap-2">
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
            className="text-[var(--lobby-red)]"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums text-[var(--lobby-red)]"
          aria-label={`シンクロ ${displayPercent}パーセント`}
        >
          {displayPercent}%
        </span>
      </div>
      {caption ? <p className="text-center text-sm text-zinc-600">{caption}</p> : null}
    </div>
  );
}
