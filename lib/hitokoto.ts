/** プロフィールの「みんなへのひとこと」(bio) の最大文字数 */
export const HITOKOTO_MAX_LENGTH = 20;

/** 表示用に最大文字数で切り詰める（超過分は … を付与） */
export function truncateHitokoto(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (t.length <= HITOKOTO_MAX_LENGTH) return t;
  return `${t.slice(0, HITOKOTO_MAX_LENGTH)}…`;
}
