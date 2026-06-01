import type { LobbyGender } from "@/lib/lobby-firestore-types";

const RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** シリアル接頭辞: {場所}{年}{回数2桁}{x|y} 例: nagoya202601x */
export function buildTicketSerialPrefix(params: {
  locationSlug: string;
  year: number;
  round: number;
  gender: LobbyGender;
}): string {
  const slug = params.locationSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) throw new Error("invalid_location_slug");
  const year = Math.floor(params.year);
  if (year < 2000 || year > 2100) throw new Error("invalid_year");
  const round = Math.max(1, Math.min(99, Math.floor(params.round)));
  const genderChar = params.gender === "female" ? "x" : "y";
  return `${slug}${year}${String(round).padStart(2, "0")}${genderChar}`;
}

export function randomTicketSerialSuffix(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += RANDOM_ALPHABET[Math.floor(Math.random() * RANDOM_ALPHABET.length)];
  }
  return out;
}

export function generateTicketSerialCode(params: {
  locationSlug: string;
  year: number;
  round: number;
  gender: LobbyGender;
  suffixLength?: number;
}): string {
  return buildTicketSerialPrefix(params) + randomTicketSerialSuffix(params.suffixLength ?? 4);
}

/** プレフィックス例表示用 */
export function formatTicketSerialExample(params: {
  locationSlug: string;
  year: number;
  round: number;
  gender: LobbyGender;
}): string {
  return `${buildTicketSerialPrefix(params)}abcd`;
}
