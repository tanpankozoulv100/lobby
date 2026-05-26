/** 同一相手とのマッチ回数バッジ（デザイン: 黄1 / 橙2 / 赤3+） */

export type MatchEncounterBadgeTone = "yellow" | "orange" | "red";

export function normalizeEncounterCount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  return 1;
}

export function getMatchEncounterBadgeTone(count: number): MatchEncounterBadgeTone {
  if (count >= 3) return "red";
  if (count === 2) return "orange";
  return "yellow";
}

export const MATCH_ENCOUNTER_BADGE_CLASS: Record<MatchEncounterBadgeTone, string> = {
  yellow: "bg-amber-400 text-amber-950",
  orange: "bg-orange-500 text-white",
  red: "bg-[var(--lobby-red)] text-white",
};
