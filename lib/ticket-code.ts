/** 入力を Firestore の ticketCodes ドキュメント ID 用に正規化（英数字のみ・大文字） */
export function normalizeSeasonTicketCode(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}
