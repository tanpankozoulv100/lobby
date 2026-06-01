import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { normalizeSeasonTicketCode } from "@/lib/ticket-code";

const TICKET_CODES = "ticketCodes";
const SEASONS = "seasons";

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

      const userGender = u.gender;
      const ticketGender = t.intendedGender;
      if (
        (ticketGender === "male" || ticketGender === "female") &&
        (userGender === "male" || userGender === "female") &&
        userGender !== ticketGender
      ) {
        throw new Error("GENDER_MISMATCH");
      }
      if ((ticketGender === "male" || ticketGender === "female") && userGender !== "male" && userGender !== "female") {
        throw new Error("PROFILE_GENDER_MISSING");
      }

      const ticketSeasonId = typeof t.seasonId === "string" ? t.seasonId.trim() : "";
      if (ticketSeasonId) {
        const seasonRef = doc(db, SEASONS, ticketSeasonId);
        const seasonSnap = await transaction.get(seasonRef);
        if (!seasonSnap.exists() || seasonSnap.data()?.status !== "published") {
          throw new Error("SEASON_INVALID");
        }
      }

      transaction.update(ticketRef, {
        usedBy: uid,
      });
      const userPatch: Record<string, unknown> = {
        ticketRedeemedAt: serverTimestamp(),
        seasonTicketCode: normalized,
        updatedAt: serverTimestamp(),
      };
      if (ticketSeasonId) {
        userPatch.currentSeasonId = ticketSeasonId;
      }
      transaction.update(userRef, userPatch);
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
    if (msg === "GENDER_MISMATCH") {
      return {
        ok: false,
        message:
          "登録した性別と、このシリアル番号のチケット区分が一致しません。Shopify で購入した性別用チケットの番号かご確認ください。",
      };
    }
    if (msg === "PROFILE_GENDER_MISSING") {
      return { ok: false, message: "先にプロフィール（性別）の登録を完了してください。" };
    }
    if (msg === "NO_USER") {
      return { ok: false, message: "プロフィールがまだありません。ページを再読み込みしてください。" };
    }
    if (msg === "SEASON_INVALID") {
      return {
        ok: false,
        message: "このチケットに紐づくシーズンが見つからないか、まだ公開されていません。運営にお問い合わせください。",
      };
    }
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied") {
      return { ok: false, message: "チケットの登録が拒否されました。セキュリティルールを確認してください。" };
    }
    return { ok: false, message: "チケットの登録に失敗しました。" };
  }
}
