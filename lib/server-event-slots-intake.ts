import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";

const EVENTS = "events";
const SLOT_CHOICES = "slotChoices";

type SlotIntakeInput = {
  eventName: string;
  dateKey: string;
  startTime: string;
  period: EventSlotPeriod;
  cohort: LobbyCohort | "AB";
  lineIndex: 0 | 1;
  eventDetail?: string;
};

let cachedApp: App | null = null;

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }
  const serviceAccount = getServiceAccountFromEnv();
  if (serviceAccount) {
    cachedApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
    return cachedApp;
  }
  cachedApp = initializeApp();
  return cachedApp;
}

function startsAtFromDateKeyAndPeriod(dateKey: string, period: EventSlotPeriod): Date {
  const y = Number(dateKey.slice(0, 4));
  const m = Number(dateKey.slice(4, 6));
  const d = Number(dateKey.slice(6, 8));
  const hour = period === "morning" ? 9 : period === "afternoon" ? 13 : 18;
  return new Date(Date.UTC(y, m - 1, d, hour - 9, 0, 0));
}

function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .slice(0, 40)
    .toLowerCase();
}

function derivePeriodFromStartTime(startTime: string): EventSlotPeriod | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!m) return null;
  const hour = Number(m[1]);
  const min = Number(m[2]);
  const total = hour * 60 + min;
  if (total >= 8 * 60 && total <= 10 * 60 + 59) return "morning";
  if (total >= 11 * 60 && total <= 16 * 60 + 59) return "afternoon";
  if (total >= 17 * 60 && total <= 22 * 60) return "evening";
  return null;
}

export function validateSlotIntakeInput(raw: unknown): { ok: true; value: SlotIntakeInput } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") return { ok: false, message: "JSON ボディが不正です。" };
  const body = raw as Record<string, unknown>;
  const eventName = typeof body.eventName === "string" ? body.eventName.trim() : "";
  if (!eventName) return { ok: false, message: "eventName は必須です。" };
  if (eventName.length > 300) return { ok: false, message: "eventName は 300 文字以内にしてください。" };

  const dateKey = typeof body.dateKey === "string" ? body.dateKey.trim() : "";
  if (!/^\d{8}$/.test(dateKey)) return { ok: false, message: "dateKey は YYYYMMDD 形式で指定してください。" };

  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const period = derivePeriodFromStartTime(startTime);
  if (!period) return { ok: false, message: "startTime は 08:00-22:00 の範囲で指定してください（朝/昼/夕に自動振り分け）。" };

  const cohort = body.cohort;
  if (cohort !== "A" && cohort !== "B" && cohort !== "AB") return { ok: false, message: "cohort は A / B / AB のいずれかです。" };

  const lineIndexRaw = Number(body.lineIndex);
  if (lineIndexRaw !== 0 && lineIndexRaw !== 1) return { ok: false, message: "lineIndex は 0 または 1 です。" };

  const eventDetail = typeof body.eventDetail === "string" ? body.eventDetail.trim() : "";
  if (eventDetail.length > 2000) return { ok: false, message: "eventDetail は 2000 文字以内にしてください。" };

  return {
    ok: true,
    value: {
      eventName,
      dateKey,
      startTime,
      period,
      cohort,
      lineIndex: lineIndexRaw as 0 | 1,
      eventDetail,
    },
  };
}

async function findOrCreateEventByName(input: SlotIntakeInput): Promise<string> {
  const db = getFirestore(getAdminApp());
  const snap = await db.collection(EVENTS).where("title", "==", input.eventName).limit(1).get();
  if (!snap.empty) {
    const id = snap.docs[0]!.id;
    // Spreadsheet intake rows should immediately appear on the app.
    await db.collection(EVENTS).doc(id).set({ isPublished: true }, { merge: true });
    return id;
  }

  const ref = db.collection(EVENTS).doc();
  await ref.set({
    title: input.eventName,
    startsAt: Timestamp.fromDate(startsAtFromDateKeyAndPeriod(input.dateKey, input.period)),
    isPublished: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function writeSlotForCohort(input: SlotIntakeInput, cohort: LobbyCohort): Promise<{ eventId: string; slotId: string }> {
  const db = getFirestore(getAdminApp());
  const eventId = await findOrCreateEventByName(input);
  const labelPart = normalizeLabel(input.eventName) || "slot";
  const slotId = `${input.dateKey}_${input.period}_${cohort}_${input.lineIndex}_${labelPart}`;
  await db
    .collection(EVENTS)
    .doc(eventId)
    .collection(SLOT_CHOICES)
    .doc(slotId)
    .set(
      {
        dateKey: input.dateKey,
        period: input.period,
        cohort,
        lineIndex: input.lineIndex,
        destinationLabel: input.eventName,
        eventDetail: input.eventDetail ?? "",
      },
      { merge: true }
    );
  return { eventId, slotId };
}

export async function createOrUpdateSlotChoiceFromIntake(
  input: SlotIntakeInput
): Promise<{ eventId: string; slotIds: string[]; period: EventSlotPeriod }> {
  if (input.cohort === "AB") {
    const a = await writeSlotForCohort(input, "A");
    const b = await writeSlotForCohort(input, "B");
    return { eventId: a.eventId, slotIds: [a.slotId, b.slotId], period: input.period };
  }
  const one = await writeSlotForCohort(input, input.cohort);
  return { eventId: one.eventId, slotIds: [one.slotId], period: input.period };
}
