import type { LobbyGender, UserProfileFields } from "@/lib/lobby-firestore-types";

export const JAPAN_PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

export type JapanPrefecture = (typeof JAPAN_PREFECTURES)[number];

export const GENDER_LABELS: Record<LobbyGender, string> = {
  male: "男性",
  female: "女性",
};

/** Firestore 保存用 YYYYMMDD */
export function parseBirthDateInput(y: string, m: string, d: string): { ok: true; birthDate: string } | { ok: false; message: string } {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) {
    return { ok: false, message: "生年を確認してください。" };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, message: "生月を確認してください。" };
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, message: "生日を確認してください。" };
  }
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return { ok: false, message: "存在しない日付です。" };
  }
  const birthDate = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const age = computeAgeFromBirthDate(birthDate);
  if (age == null || age < 18) {
    return { ok: false, message: "18歳以上のみご利用いただけます。" };
  }
  if (age > 100) {
    return { ok: false, message: "生年月日を確認してください。" };
  }
  return { ok: true, birthDate };
}

export function computeAgeFromBirthDate(birthDate: string, asOf: Date = new Date()): number | null {
  if (!/^\d{8}$/.test(birthDate)) return null;
  const y = Number(birthDate.slice(0, 4));
  const m = Number(birthDate.slice(4, 6));
  const d = Number(birthDate.slice(6, 8));
  let age = asOf.getFullYear() - y;
  const md = asOf.getMonth() + 1 - m;
  if (md < 0 || (md === 0 && asOf.getDate() < d)) age -= 1;
  return age;
}

export function formatBirthDateJa(birthDate: string | undefined): string {
  if (!birthDate || !/^\d{8}$/.test(birthDate)) return "—";
  return `${birthDate.slice(0, 4)}年${Number(birthDate.slice(4, 6))}月${Number(birthDate.slice(6, 8))}日`;
}

export function validateLegalName(raw: string): { ok: true; legalName: string } | { ok: false; message: string } {
  const legalName = raw.trim().replace(/\s+/g, " ");
  if (!legalName) return { ok: false, message: "本名を入力してください。" };
  if (legalName.length > 40) return { ok: false, message: "本名は40文字以内にしてください。" };
  return { ok: true, legalName };
}

export function hasRequiredRegistrationFields(profile: UserProfileFields | null | undefined): boolean {
  if (!profile) return false;
  if (profile.gender !== "male" && profile.gender !== "female") return false;
  if (!profile.birthDate || !/^\d{8}$/.test(profile.birthDate)) return false;
  if (!profile.legalName?.trim()) return false;
  if (!profile.displayName?.trim()) return false;
  if (!profile.prefecture?.trim()) return false;
  return true;
}

export function isPrefectureValid(v: string): v is JapanPrefecture {
  return (JAPAN_PREFECTURES as readonly string[]).includes(v);
}
