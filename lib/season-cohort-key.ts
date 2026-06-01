/** シーズンの場所・年・回数から A/B フォールバック用キーを自動生成 */
export function buildCohortSeasonKey(locationSlug: string, year: number, round: number): string {
  const slug = locationSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return "season";
  const y = Math.floor(year);
  const r = Math.max(1, Math.min(99, Math.floor(round)));
  return `${slug}-${y}-${String(r).padStart(2, "0")}`;
}
