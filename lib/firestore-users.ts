import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { LobbyGender, UserProfileFields } from "@/lib/lobby-firestore-types";
import {
  computeAgeFromBirthDate,
  isPrefectureValid,
  parseBirthDateInput,
  validateLegalName,
} from "@/lib/lobby-profile";

const USERS = "users";

function mapProfileDoc(d: Record<string, unknown>): UserProfileFields {
  const rawIdentity = d.identityStatus;
  const identityStatus =
    rawIdentity === "none" ||
    rawIdentity === "pending" ||
    rawIdentity === "approved" ||
    rawIdentity === "rejected"
      ? rawIdentity
      : undefined;
  const gender = d.gender === "male" || d.gender === "female" ? d.gender : undefined;
  const birthDate = typeof d.birthDate === "string" ? d.birthDate : undefined;
  const legalName = typeof d.legalName === "string" ? d.legalName : undefined;
  return {
    displayName: typeof d.displayName === "string" ? d.displayName : "",
    bio: typeof d.bio === "string" ? d.bio : "",
    legalName: legalName?.trim() ? legalName.trim() : undefined,
    gender,
    birthDate: /^\d{8}$/.test(birthDate ?? "") ? birthDate : undefined,
    prefecture: typeof d.prefecture === "string" ? d.prefecture : undefined,
    participantNo: typeof d.participantNo === "number" ? d.participantNo : undefined,
    lobbyOpenedAt: d.lobbyOpenedAt as UserProfileFields["lobbyOpenedAt"],
    participantSerial: typeof d.participantSerial === "string" ? d.participantSerial : undefined,
    identityStatus,
    idDocumentPath: typeof d.idDocumentPath === "string" ? d.idDocumentPath : undefined,
    identitySubmittedAt: d.identitySubmittedAt as UserProfileFields["identitySubmittedAt"],
    ticketRedeemedAt: d.ticketRedeemedAt as UserProfileFields["ticketRedeemedAt"],
    seasonTicketCode: typeof d.seasonTicketCode === "string" ? d.seasonTicketCode : undefined,
    accountStatus:
      d.accountStatus === "active" || d.accountStatus === "suspended" ? d.accountStatus : undefined,
    reportReceivedCount: typeof d.reportReceivedCount === "number" ? d.reportReceivedCount : undefined,
    cohortFlipActive: d.cohortFlipActive === true ? true : undefined,
    createdAt: d.createdAt as UserProfileFields["createdAt"],
    updatedAt: d.updatedAt as UserProfileFields["updatedAt"],
  };
}

/** 旧フロー互換: 最小プロフィールのみ（新規登録は createInitialUserProfile を使う） */
export async function ensureUserProfile(
  uid: string,
  email: string | null | undefined
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const fallbackName = email?.split("@")[0]?.trim() || `ユーザー${uid.slice(0, 6)}`;
  await setDoc(ref, {
    displayName: fallbackName,
    bio: "",
    identityStatus: "none",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export type InitialProfileInput = {
  legalName: string;
  displayName: string;
  gender: LobbyGender;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  prefecture: string;
};

export async function createInitialUserProfile(
  uid: string,
  input: InitialProfileInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) return { ok: false, message: "Firestore に接続できません。" };

  const legal = validateLegalName(input.legalName);
  if (!legal.ok) return { ok: false, message: legal.message };

  const name = input.displayName.trim();
  if (!name) return { ok: false, message: "ユーザー名を入力してください。" };
  if (name.length > 50) return { ok: false, message: "ユーザー名は50文字以内にしてください。" };

  const parsedBirth = parseBirthDateInput(input.birthYear, input.birthMonth, input.birthDay);
  if (!parsedBirth.ok) return { ok: false, message: parsedBirth.message };

  const prefecture = input.prefecture.trim();
  if (!isPrefectureValid(prefecture)) {
    return { ok: false, message: "居住地（都道府県）を選択してください。" };
  }

  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    if (existing.gender != null || existing.birthDate != null || existing.legalName != null) {
      return { ok: false, message: "プロフィールはすでに登録済みです。" };
    }
    try {
      await updateDoc(ref, {
        legalName: legal.legalName,
        displayName: name,
        gender: input.gender,
        birthDate: parsedBirth.birthDate,
        prefecture,
        updatedAt: serverTimestamp(),
      });
      return { ok: true };
    } catch {
      return { ok: false, message: "プロフィールの保存に失敗しました。" };
    }
  }

  try {
    await setDoc(ref, {
      legalName: legal.legalName,
      displayName: name,
      bio: "",
      gender: input.gender,
      birthDate: parsedBirth.birthDate,
      prefecture,
      identityStatus: "none",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "プロフィールの作成に失敗しました。" };
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (data: UserProfileFields | null) => void,
  onError?: (message: string) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) {
    onError?.("Firestore に接続できません。設定を確認してください。");
    return null;
  }
  const ref = doc(db, USERS, uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapProfileDoc(snap.data() as Record<string, unknown>));
    },
    (err) => {
      const code = "code" in err ? String((err as { code: string }).code) : "";
      if (code === "permission-denied") {
        onError?.("プロフィールの読み取りが拒否されました。セキュリティルールを確認してください。");
      } else {
        onError?.("プロフィールの読み込みに失敗しました。");
      }
    }
  );
}

export async function updateUserProfile(
  uid: string,
  displayName: string,
  bio: string,
  prefecture: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { ok: false, message: "Firestore に接続できません。" };
  }
  const name = displayName.trim();
  const bioTrim = bio.trim();
  const pref = prefecture.trim();
  if (!name) {
    return { ok: false, message: "表示名を入力してください。" };
  }
  if (name.length > 50) {
    return { ok: false, message: "表示名は50文字以内にしてください。" };
  }
  if (bioTrim.length > 500) {
    return { ok: false, message: "自己紹介は500文字以内にしてください。" };
  }
  if (!isPrefectureValid(pref)) {
    return { ok: false, message: "居住地（都道府県）を選択してください。" };
  }
  const ref = doc(db, USERS, uid);
  try {
    await updateDoc(ref, {
      displayName: name,
      bio: bioTrim,
      prefecture: pref,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "permission-denied") {
      return { ok: false, message: "保存が拒否されました。セキュリティルールを確認してください。" };
    }
    if (code === "not-found") {
      return { ok: false, message: "プロフィールがまだありません。ページを再読み込みしてください。" };
    }
    return { ok: false, message: "保存に失敗しました。" };
  }
}

export function getProfileAge(profile: UserProfileFields | null | undefined): number | null {
  if (!profile?.birthDate) return null;
  return computeAgeFromBirthDate(profile.birthDate);
}
