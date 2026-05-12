import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { subscribeOutboundLinks, type OutboundLinkRow } from "@/lib/firestore-connections";
import { isPeerBlocked, subscribeBlockedPeerUids } from "@/lib/firestore-safety";
import { getSeasonEndDate } from "@/lib/season-config";

const CHAT_WINDOW_HOURS = 24;
const FINAL_DAY_CHAT_WINDOW_HOURS = 72;
const TICKET_WINDOW_HOURS = 72;

const DATE_INVITE_TICKETS = "dateInviteTickets";
const DATE_INVITES = "dateInvites";

export type ActiveChatPeer = {
  uid: string;
  matchedAt: Date;
  expiresAt: Date;
};

export type ActiveDateInviteTicket = {
  id: string;
  milestoneMatches: number;
  expiresAt: Date;
};

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return null;
}

function ymdInJst(d: Date): string {
  const dtf = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function chatWindowHoursForMatch(matchedAt: Date): number {
  const isFinalDay = ymdInJst(matchedAt) === ymdInJst(getSeasonEndDate());
  return isFinalDay ? FINAL_DAY_CHAT_WINDOW_HOURS : CHAT_WINDOW_HOURS;
}

export function subscribeActiveChatPeers(
  uid: string,
  onData: (rows: ActiveChatPeer[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }

  let outboundRows: OutboundLinkRow[] = [];
  const blocked = new Set<string>();

  const emit = () => {
    const now = Date.now();
    const active = outboundRows
      .filter((r) => !blocked.has(r.peerUid))
      .map((r) => {
        const matchedAt = asDate(r.createdAt);
        if (!matchedAt) return null;
        const chatWindowHours = chatWindowHoursForMatch(matchedAt);
        const expiresAt = new Date(matchedAt.getTime() + chatWindowHours * 60 * 60 * 1000);
        if (expiresAt.getTime() <= now) return null;
        return { uid: r.peerUid, matchedAt, expiresAt };
      })
      .filter((x): x is ActiveChatPeer => x !== null)
      .sort((a, b) => b.matchedAt.getTime() - a.matchedAt.getTime());
    onData(active);
  };

  const unsubOut = subscribeOutboundLinks(
    uid,
    (rows) => {
      outboundRows = rows;
      emit();
    },
    onError
  );

  if (!unsubOut) return null;

  const unsubBlk = subscribeBlockedPeerUids(
    uid,
    (uids) => {
      blocked.clear();
      for (const id of uids) blocked.add(id);
      emit();
    },
    onError
  );

  return () => {
    unsubOut();
    unsubBlk?.();
  };
}

export async function ensureDateInviteTicketsByMatchCount(uid: string, matchCount: number): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const grants = Math.floor(matchCount / 10);
  if (grants <= 0) return;

  const batch = writeBatch(db);
  let writeCount = 0;
  for (let n = 1; n <= grants; n++) {
    const milestoneMatches = n * 10;
    const ticketId = `m${milestoneMatches}`;
    const ref = doc(db, "users", uid, DATE_INVITE_TICKETS, ticketId);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    const expiresAt = Timestamp.fromMillis(Date.now() + TICKET_WINDOW_HOURS * 60 * 60 * 1000);
    batch.set(ref, {
      milestoneMatches,
      grantedAt: serverTimestamp(),
      expiresAt,
      consumedAt: null,
      consumedByInviteId: null,
    });
    writeCount += 1;
  }
  if (writeCount > 0) {
    await batch.commit();
  }
}

export function subscribeActiveDateInviteTickets(
  uid: string,
  onData: (rows: ActiveDateInviteTicket[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;
  const q = query(
    collection(db, "users", uid, DATE_INVITE_TICKETS),
    where("consumedAt", "==", null),
    orderBy("expiresAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const rows: ActiveDateInviteTicket[] = [];
      snap.forEach((d) => {
        const x = d.data();
        const expiresAt = asDate(x.expiresAt);
        if (!expiresAt || expiresAt.getTime() <= now) return;
        rows.push({
          id: d.id,
          milestoneMatches: typeof x.milestoneMatches === "number" ? x.milestoneMatches : 0,
          expiresAt,
        });
      });
      onData(rows);
    },
    () => onError?.("お誘い券の取得に失敗しました。")
  );
}

export async function sendDateInvite(params: {
  uid: string;
  toUid: string;
  location: string;
  proposedAt: Date;
  message?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };
  const location = params.location.trim();
  if (!location) return { ok: false, message: "場所を入力してください。" };
  if (params.toUid === params.uid) return { ok: false, message: "自分は選択できません。" };
  if (await isPeerBlocked(params.uid, params.toUid)) {
    return { ok: false, message: "ブロック中の相手には送信できません。" };
  }

  const ticketsQ = query(
    collection(db, "users", params.uid, DATE_INVITE_TICKETS),
    where("consumedAt", "==", null),
    orderBy("expiresAt", "asc")
  );
  const ticketSnap = await getDocs(ticketsQ);
  const now = Date.now();
  const ticketDoc = ticketSnap.docs.find((d) => {
    const dt = asDate(d.data().expiresAt);
    return !!dt && dt.getTime() > now;
  });
  if (!ticketDoc) return { ok: false, message: "利用可能なお誘い券がありません。" };

  const inviteRef = doc(collection(db, "users", params.uid, DATE_INVITES));
  const ticketRef = doc(db, "users", params.uid, DATE_INVITE_TICKETS, ticketDoc.id);
  const batch = writeBatch(db);
  batch.set(inviteRef, {
    toUid: params.toUid,
    location,
    proposedAt: Timestamp.fromDate(params.proposedAt),
    message: params.message?.trim() ?? "",
    ticketId: ticketDoc.id,
    createdAt: serverTimestamp(),
  });
  batch.update(ticketRef, {
    consumedAt: serverTimestamp(),
    consumedByInviteId: inviteRef.id,
  });
  await batch.commit();
  return { ok: true };
}
