import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { normalizeSeasonTicketCode } from "@/lib/ticket-code";

const TICKET_CODES = "ticketCodes";

export async function redeemSeasonTicket(
  uid: string,
  rawCode: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { ok: false, message: "Firestore に接続できません。" };
  }
  const normalized = normalizeSeasonTicketCode(rawCode);
  if (normalized.length < 8) {
    return { ok: false, message: "シリアル番号の形式を確認してください（8文字以上の英数字）。" };
  }
  if (normalized.length > 64) {
    return { ok: false, message: "シリアル番号が長すぎます。" };
  }

  const ticketRef = doc(db, TICKET_CODES, normalized);
  const userRef = doc(db, "users", uid);

  try {
    await runTransaction(db, async (transaction) => {
      const ticketSnap = await transaction.get(ticketRef);
      if (!ticketSnap.exists()) {
        throw new Error("NOT_FOUND");
      }
      const t = ticketSnap.data();
      const usedBy = t.usedBy;
      if (usedBy != null && usedBy !== "") {
        throw new Error("ALREADY_USED");
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("NO_USER");
      }
      const u = userSnap.data();
      if (u.ticketRedeemedAt != null) {
        throw new Error("USER_ALREADY");
      }

      transaction.update(ticketRef, {
        usedBy: uid,
      });
      transaction.update(userRef, {
        ticketRedeemedAt: serverTimestamp(),
        seasonTicketCode: normalized,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") {
      return { ok: false, message: "このシリアル番号は見つかりませんでした。入力内容を確認するか、運営に問い合わせてください。" };
    }
    if (msg === "ALREADY_USED") {
      return { ok: false, message: "このシリアルはすでに使用されています。" };
    }
    if (msg === "USER_ALREADY") {
      return { ok: false, message: "すでにチケットを登録済みです。" };
    }
    if (msg === "NO_USER") {
      return { ok: false, message: "プロフィールがまだありません。ページを再読み込みしてください。" };
    }
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied") {
      return { ok: false, message: "チケットの登録が拒否されました。セキュリティルールを確認してください。" };
    }
    return { ok: false, message: "チケットの登録に失敗しました。" };
  }
}
