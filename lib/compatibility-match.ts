import {
  COMPATIBILITY_QUESTION_IDS,
  type CompatibilityAnswers,
} from "@/lib/compatibility-questions";

/** 一致した設問数（0〜12）に対応する表示パーセント（デザイン正本） */
export const COMPATIBILITY_PERCENT_BY_MATCH_COUNT: readonly number[] = [
  0, 8, 17, 25, 33, 41, 50, 58, 66, 75, 83, 92, 100,
];

export type CompatibilityMatchResult = {
  /** 同じ回答だった設問数 */
  matchCount: number;
  /** 表示用パーセント（0〜100） */
  percent: number;
  /** 自分・相手ともに回答済みの設問数 */
  comparableCount: number;
};

/**
 * 12問のうち、両者が同じ選択肢を選んだ数でパーセントを算出する。
 * 未回答の設問は一致にカウントしない（分母は常に12問）。
 */
export function computeCompatibilityMatch(
  mine: CompatibilityAnswers | null | undefined,
  theirs: CompatibilityAnswers | null | undefined
): CompatibilityMatchResult {
  let matchCount = 0;
  let comparableCount = 0;
  for (const id of COMPATIBILITY_QUESTION_IDS) {
    const a = mine?.[id];
    const b = theirs?.[id];
    if (!a || !b) continue;
    comparableCount += 1;
    if (a === b) matchCount += 1;
  }
  const clamped = Math.min(12, Math.max(0, matchCount));
  return {
    matchCount: clamped,
    percent: COMPATIBILITY_PERCENT_BY_MATCH_COUNT[clamped] ?? 0,
    comparableCount,
  };
}
