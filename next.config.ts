import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

try {
  loadEnvConfig(process.cwd());
} catch (e) {
  console.warn("[next.config] loadEnvConfig:", e);
}

/** .env.local を直接読む（失敗してもビルドは落とさない） */
function parseDotEnvFileSafe(filePath: string): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith("\"") && val.endsWith("\"")) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch (e) {
    console.warn("[next.config] parseDotEnvFileSafe:", e);
    return {};
  }
}

const PUBLIC_FIREBASE_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const fromEnvLocal = parseDotEnvFileSafe(path.join(process.cwd(), ".env.local"));

const publicFirebaseEnv: Record<string, string> = {};
for (const key of PUBLIC_FIREBASE_KEYS) {
  publicFirebaseEnv[key] = fromEnvLocal[key] ?? process.env[key] ?? "";
}
/** オンボーディング開発バイパス（Firebase と同じ経路でクライアントに載せる） */
const bypassFromFile = (fromEnvLocal.NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING ?? "").trim();
const bypassFromProcess = (process.env.NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING ?? "").trim();
publicFirebaseEnv.NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING = bypassFromFile || bypassFromProcess || "";

const nextPublicDebug = (
  fromEnvLocal.NEXT_PUBLIC_LOBBY_DEBUG ??
  process.env.NEXT_PUBLIC_LOBBY_DEBUG ??
  ""
)
  .trim();
/** クライアントで `showEventsDebug` などと同じ経路で焼き込む（.env だけに頼ると未反映になることがある） */
const publicLobbyEnv: Record<string, string> = {
  ...publicFirebaseEnv,
  NEXT_PUBLIC_LOBBY_DEBUG: nextPublicDebug,
};

if (process.env.NODE_ENV !== "production") {
  console.log(
    `[Lobby] NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING: file="${bypassFromFile}" dotenv="${bypassFromProcess}" → "${publicLobbyEnv.NEXT_PUBLIC_LOBBY_DEV_BYPASS_ONBOARDING}"`
  );
  console.log(`[Lobby] NEXT_PUBLIC_LOBBY_DEBUG: file+process → "${nextPublicDebug}"`);
}

/** 同一 Wi-Fi 上のスマホから `next dev` で読み込むときのオリジン許可（開発時のみ有効） */
const defaultAllowedDevOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  "172.*.*.*",
  "*.local",
];

function parseExtraAllowedDevOrigins(): string[] {
  const raw =
    fromEnvLocal.NEXT_DEV_ALLOWED_HOSTS ?? process.env.NEXT_DEV_ALLOWED_HOSTS ?? "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  env: publicLobbyEnv,
  allowedDevOrigins: [...defaultAllowedDevOrigins, ...parseExtraAllowedDevOrigins()],
};

export default nextConfig;
