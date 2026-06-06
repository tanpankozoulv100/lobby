import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
} from "firebase-admin/firestore";
import { dateKeyFromLocalDate } from "@/lib/calendar-utils";
import type { LobbyCohort } from "@/lib/lobby-firestore-types";

type EligibleUser = { uid: string };
type ConflictPair = { a: string; b: string };

let appCache: App | null = null;

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!json.project_id || !json.client_email || !json.private_key) return null;
    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch {
    return null;
  }
}

function getAdminDb() {
  if (!appCache) {
    if (getApps().length > 0) {
      appCache = getApps()[0]!;
    } else {
      const sa = parseServiceAccountFromEnv();
      appCache = sa
        ? initializeApp({ credential: cert(sa), projectId: sa.projectId })
        : initializeApp();
    }
  }
  return getFirestore(appCache);
}

function toJstDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

function fromJstParts(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, -9, 0, 0));
}

function startOfJstDay(d: Date): Date {
  const j = toJstDate(d);
  return fromJstParts(j.getUTCFullYear(), j.getUTCMonth() + 1, j.getUTCDate());
}

function getNextSundayJst(base: Date): Date {
  const start = startOfJstDay(base);
  const j = toJstDate(start);
  const day = j.getUTCDay();
  const delta = (7 - day) % 7;
  const out = new Date(start);
  out.setUTCDate(out.getUTCDate() + delta);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function weekKeyFromSunday(sundayJst: Date): string {
  return dateKeyFromLocalDate(toJstDate(sundayJst));
}

function normalizedPair(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function buildConflictSet(pairs: ConflictPair[]): Set<string> {
  const s = new Set<string>();
  for (const p of pairs) s.add(normalizedPair(p.a, p.b));
  return s;
}

function countConflicts(
  uid: string,
  bucket: string[],
  conflictSet: Set<string>,
  groupOfPrevWeek: Map<string, LobbyCohort | undefined>
): number {
  let score = 0;
  for (const other of bucket) {
    if (conflictSet.has(normalizedPair(uid, other))) score += 100;
    if (groupOfPrevWeek.get(other) === groupOfPrevWeek.get(uid)) score += 1;
  }
  return score;
}

function assignCohorts(users: EligibleUser[], prevWeekGroup: Map<string, LobbyCohort | undefined>, conflicts: ConflictPair[]) {
  const ids = users.map((u) => u.uid);
  const targetA = Math.ceil(ids.length / 2);
  const groupA: string[] = [];
  const groupB: string[] = [];
  const conflictSet = buildConflictSet(conflicts);

  ids.sort((a, b) => {
    const ap = prevWeekGroup.get(a);
    const bp = prevWeekGroup.get(b);
    if (ap === bp) return a.localeCompare(b);
    if (ap === undefined) return -1;
    if (bp === undefined) return 1;
    return a.localeCompare(b);
  });

  for (const uid of ids) {
    const prev = prevWeekGroup.get(uid);
    const prefer: LobbyCohort = prev === "A" ? "B" : "A";
    const scores = {
      A: countConflicts(uid, groupA, conflictSet, prevWeekGroup),
      B: countConflicts(uid, groupB, conflictSet, prevWeekGroup),
    };
    const canPutA = groupA.length < targetA;
    const canPutB = groupB.length < ids.length - targetA;
    let selected: LobbyCohort = prefer;

    if (prefer === "A" && !canPutA) selected = "B";
    if (prefer === "B" && !canPutB) selected = "A";
    if (canPutA && canPutB && scores.A !== scores.B) {
      selected = scores.A <= scores.B ? "A" : "B";
    }
    if (selected === "A") groupA.push(uid);
    else groupB.push(uid);
  }

  const assignment = new Map<string, LobbyCohort>();
  for (const uid of groupA) assignment.set(uid, "A");
  for (const uid of groupB) assignment.set(uid, "B");
  return assignment;
}

async function fetchEligibleUsers() {
  const db = getAdminDb();
  const snap = await db.collection("users").where("identityStatus", "==", "approved").get();
  const users: EligibleUser[] = [];
  snap.forEach((d) => {
    const data = d.data() as { ticketRedeemedAt?: unknown };
    if (data.ticketRedeemedAt) users.push({ uid: d.id });
  });
  return users;
}

async function fetchPrevWeekAssignments(prevWeekKey: string) {
  const db = getAdminDb();
  const users = await db.collection("users").get();
  const out = new Map<string, LobbyCohort | undefined>();
  users.forEach((u) => {
    out.set(u.id, undefined);
  });
  const reads = await Promise.all(
    [...out.keys()].map(async (uid) => {
      const snap = await db
        .collection("users")
        .doc(uid)
        .collection("cohortWeeks")
        .where("weekKey", "==", prevWeekKey)
        .get();
      snap.forEach((d) => {
        const c = (d.data() as { cohort?: unknown }).cohort;
        if (c === "A" || c === "B") out.set(uid, c);
      });
    })
  );
  void reads;
  return out;
}

async function fetchActiveConflicts(): Promise<ConflictPair[]> {
  const db = getAdminDb();
  const snap = await db.collection("groupConflicts").get();
  const pairs: ConflictPair[] = [];
  snap.forEach((d) => {
    const data = d.data() as { uidA?: unknown; uidB?: unknown; active?: unknown };
    if (data.active === false) return;
    if (typeof data.uidA === "string" && typeof data.uidB === "string" && data.uidA !== data.uidB) {
      pairs.push({ a: data.uidA, b: data.uidB });
    }
  });
  return pairs;
}

export async function runWeeklyCohortAndPublishAutomation(input?: { targetSundayDateKey?: string }) {
  /**
   * 毎週木曜 Cron 想定: 次週（日曜始まり）の表示週を公開し、同週の A/B を cohortWeeks に書き込む。
   * - eventDisplayWindow/current … ユーザーが見える日付範囲（1週間のみ）
   * - cohortWeeks/{weekKey} … その週の A/B（過去 weekKey は触らない）
   * スプシ登録済みの slotChoices はシーズン全体に存在するが、表示は eventDisplayWindow で絞る。
   */
  const base = input?.targetSundayDateKey
    ? fromJstParts(
        Number(input.targetSundayDateKey.slice(0, 4)),
        Number(input.targetSundayDateKey.slice(4, 6)),
        Number(input.targetSundayDateKey.slice(6, 8))
      )
    : getNextSundayJst(new Date());

  const weekStart = base;
  const weekEnd = addDays(base, 6);
  const prevWeekStart = addDays(base, -7);

  const weekKey = weekKeyFromSunday(weekStart);
  const prevWeekKey = weekKeyFromSunday(prevWeekStart);
  const visibleFromDateKey = dateKeyFromLocalDate(toJstDate(weekStart));
  const visibleToDateKey = dateKeyFromLocalDate(toJstDate(weekEnd));

  const users = await fetchEligibleUsers();
  const prevWeekMap = await fetchPrevWeekAssignments(prevWeekKey);
  const conflicts = await fetchActiveConflicts();
  const assignment = assignCohorts(users, prevWeekMap, conflicts);

  const db = getAdminDb();
  const batch = db.batch();
  for (const user of users) {
    const cohort = assignment.get(user.uid) ?? "A";
    const ref = db.collection("users").doc(user.uid).collection("cohortWeeks").doc(weekKey);
    batch.set(
      ref,
      {
        weekKey,
        weekStartDateKey: visibleFromDateKey,
        weekEndDateKey: visibleToDateKey,
        cohort,
        generatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  const windowRef = db.collection("eventDisplayWindow").doc("current");
  batch.set(
    windowRef,
    {
      weekKey,
      visibleFromDateKey,
      visibleToDateKey,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  return {
    weekKey,
    visibleFromDateKey,
    visibleToDateKey,
    eligibleUsers: users.length,
    countA: [...assignment.values()].filter((c) => c === "A").length,
    countB: [...assignment.values()].filter((c) => c === "B").length,
  };
}
