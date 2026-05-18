/** 画面表示用の参加者番号（運営は 000、一般は 001〜999 は3桁、1000〜は4桁） */
export function formatParticipantNoDisplay(
  participantNo: number | undefined | null,
  isLobbyStaff: boolean
): string {
  if (isLobbyStaff || participantNo === 0) return "000";
  if (typeof participantNo !== "number" || participantNo < 1) return "—";
  if (participantNo <= 999) return String(participantNo).padStart(3, "0");
  return String(participantNo).padStart(4, "0");
}
