/** 6 文字の連携コードを画面表示用に整形（例: ABC123 → ABC-123） */
export function formatConnectionCodeDisplay(code: string): string {
  const n = code.trim().toUpperCase();
  if (n.length === 6) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return n;
}
