import { collection, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { CohortWeekFields, LobbyCohort } from "@/lib/lobby-firestore-types";
import { isDateKeyInRange } from "@/lib/calendar-utils";

const COHORT_WEEKS = "cohortWeeks";

export type CohortWeekRow = { id: string } & CohortWeekFields;

function mapRow(id: string, data: Record<string, unknown>): CohortWeekRow | null {
  const weekKey = typeof data.weekKey === "string" ? data.weekKey : "";
  const weekStartDateKey = typeof data.weekStartDateKey === "string" ? data.weekStartDateKey : "";
  const weekEndDateKey = typeof data.weekEndDateKey === "string" ? data.weekEndDateKey : "";
  const cohort = data.cohort;
  if (!weekKey || !/^\d{8}$/.test(weekStartDateKey) || !/^\d{8}$/.test(weekEndDateKey)) return null;
  if (cohort !== "A" && cohort !== "B") return null;
  return {
    id,
    weekKey,
    weekStartDateKey,
    weekEndDateKey,
    cohort: cohort as LobbyCohort,
    generatedAt: data.generatedAt as CohortWeekRow["generatedAt"],
  };
}

export function subscribeUserCohortWeeks(
  uid: string,
  onData: (rows: CohortWeekRow[]) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。");
    return null;
  }
  const q = query(collection(db, "users", uid, COHORT_WEEKS), orderBy("weekStartDateKey", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: CohortWeekRow[] = [];
      snap.forEach((d) => {
        const row = mapRow(d.id, d.data() as Record<string, unknown>);
        if (row) rows.push(row);
      });
      onData(rows);
    },
    () => onError?.("グループ情報の取得に失敗しました。")
  );
}

/** 週次 A/B 割当（cohortWeeks）のみ。未割当週は null（ハッシュ fallback なし）。 */
export function resolveCohortAtDateKey(
  rows: CohortWeekRow[],
  dateKey: string
): LobbyCohort | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    if (isDateKeyInRange(dateKey, row.weekStartDateKey, row.weekEndDateKey)) return row.cohort;
  }
  return null;
}

/** 通報コホート反転を週次割当に適用 */
export function resolveEffectiveCohortAtDateKey(
  rows: CohortWeekRow[],
  dateKey: string,
  cohortFlipActive?: boolean
): LobbyCohort | null {
  const assigned = resolveCohortAtDateKey(rows, dateKey);
  if (assigned === null) return null;
  if (!cohortFlipActive) return assigned;
  return assigned === "A" ? "B" : "A";
}
