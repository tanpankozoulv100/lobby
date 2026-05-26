/** 連携コード入力の正規化（6文字・英数字） */

export const CONNECTION_CODE_LENGTH = 6;

export function normalizeConnectionCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, CONNECTION_CODE_LENGTH);
}

/** 貼り付け・QR文字列から6文字を取り出す */
export function parseConnectionCodePaste(raw: string): string {
  const t = raw.trim();
  const direct = normalizeConnectionCodeInput(t);
  if (direct.length === CONNECTION_CODE_LENGTH) return direct;
  const m = t.match(/LOBBY\s*:\s*([A-Za-z0-9]{6})/i);
  if (m) return normalizeConnectionCodeInput(m[1]!);
  return normalizeConnectionCodeInput(t);
}
