import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { SeasonFields, SeasonStatus } from "@/lib/lobby-firestore-types";
import { seasonFieldsToDisplay, type SeasonDisplay } from "@/lib/season-display";
import { buildCohortSeasonKey } from "@/lib/season-cohort-key";

const SEASONS = "seasons";

function parseSeasonDoc(id: string, d: Record<string, unknown>): SeasonFields | null {
  const status = d.status;
  if (status !== "draft" && status !== "published" && status !== "archived") return null;
  const name = typeof d.name === "string" ? d.name.trim() : "";
  const locationLabel = typeof d.locationLabel === "string" ? d.locationLabel.trim() : "";
  const headerTitle = typeof d.headerTitle === "string" ? d.headerTitle.trim() : "";
  const cardTitle = typeof d.cardTitle === "string" ? d.cardTitle.trim() : "";
  const dateRangeLabel = typeof d.dateRangeLabel === "string" ? d.dateRangeLabel.trim() : "";
  const locationSlug = typeof d.locationSlug === "string" ? d.locationSlug.trim().toLowerCase() : "";
  const year = typeof d.year === "number" ? d.year : 0;
  const round = typeof d.round === "number" ? d.round : 1;
  const cohortSeasonKey =
    typeof d.cohortSeasonKey === "string" && d.cohortSeasonKey.trim()
      ? d.cohortSeasonKey.trim()
      : buildCohortSeasonKey(locationSlug, year > 0 ? year : new Date().getFullYear(), round);
  const redeemedCount = typeof d.redeemedCount === "number" ? d.redeemedCount : 0;
  const issuedTicketCount = typeof d.issuedTicketCount === "number" ? d.issuedTicketCount : 0;
  if (!name || !cardTitle || !cohortSeasonKey || !d.startAt || !d.endAt) return null;
  return {
    name,
    locationLabel,
    headerTitle: headerTitle || cardTitle,
    cardTitle,
    dateRangeLabel,
    startAt: d.startAt as SeasonFields["startAt"],
    endAt: d.endAt as SeasonFields["endAt"],
    cohortSeasonKey,
    locationSlug,
    year: year > 0 ? year : new Date().getFullYear(),
    round: round >= 1 ? Math.floor(round) : 1,
    redeemedCount: Math.max(0, Math.floor(redeemedCount)),
    issuedTicketCount: Math.max(0, Math.floor(issuedTicketCount)),
    status: status as SeasonStatus,
    isLegacyDefault: d.isLegacyDefault === true,
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : undefined,
    createdAt: d.createdAt as SeasonFields["createdAt"],
    updatedAt: d.updatedAt as SeasonFields["updatedAt"],
  };
}

export async function fetchSeasonFields(seasonId: string): Promise<SeasonFields | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, SEASONS, seasonId));
  if (!snap.exists()) return null;
  return parseSeasonDoc(snap.id, snap.data());
}

export async function fetchSeasonDisplay(seasonId: string): Promise<SeasonDisplay | null> {
  const fields = await fetchSeasonFields(seasonId);
  if (!fields || fields.status !== "published") return null;
  return seasonFieldsToDisplay(seasonId, fields);
}

export async function fetchLegacyDefaultSeasonDisplay(): Promise<SeasonDisplay | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const q = query(collection(db, SEASONS), where("isLegacyDefault", "==", true), limit(1));
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  const fields = parseSeasonDoc(first.id, first.data());
  if (!fields || fields.status !== "published") return null;
  return seasonFieldsToDisplay(first.id, fields);
}

export async function fetchUserSeasonEndDate(uid: string): Promise<Date | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return null;
  const seasonId = userSnap.data()?.currentSeasonId;
  if (typeof seasonId !== "string" || !seasonId) {
    const legacy = await fetchLegacyDefaultSeasonDisplay();
    return legacy?.endAt ?? null;
  }
  const fields = await fetchSeasonFields(seasonId);
  if (!fields) return null;
  const end = fields.endAt;
  if (end && typeof end === "object" && "toDate" in end && typeof end.toDate === "function") {
    return end.toDate();
  }
  return null;
}

export function subscribeSeason(
  seasonId: string,
  onData: (fields: SeasonFields | null) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  return onSnapshot(
    doc(db, SEASONS, seasonId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(parseSeasonDoc(snap.id, snap.data()));
    },
    () => onError?.("シーズン情報の取得に失敗しました。")
  );
}
