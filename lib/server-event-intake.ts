import { addDoc, collection, getFirestore, Timestamp } from "firebase-admin/firestore";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";

const EVENTS = "events";

type IntakeInput = {
  title: string;
  startsAt: string;
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

export function validateExternalEventInput(raw: unknown): { ok: true; value: IntakeInput } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "JSON ボディが不正です。" };
  }
  const body = raw as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, message: "title は必須です。" };
  if (title.length > 300) return { ok: false, message: "title は 300 文字以内で入力してください。" };

  const startsAtRaw = typeof body.startsAt === "string" ? body.startsAt.trim() : "";
  if (!startsAtRaw) return { ok: false, message: "startsAt は必須です。" };
  const startsAtDate = new Date(startsAtRaw);
  if (Number.isNaN(startsAtDate.getTime())) {
    return { ok: false, message: "startsAt は ISO 日時文字列で指定してください。" };
  }

  return {
    ok: true,
    value: {
      title,
      startsAt: startsAtDate.toISOString(),
    },
  };
}

export async function createEventFromExternalIntake(input: IntakeInput): Promise<string> {
  const app = getAdminApp();
  const db = getFirestore(app);
  const startsAtDate = new Date(input.startsAt);
  const ref = await addDoc(collection(db, EVENTS), {
    title: input.title,
    startsAt: Timestamp.fromDate(startsAtDate),
    isPublished: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}
