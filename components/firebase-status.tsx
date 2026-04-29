"use client";

import { getFirebaseApp, isFirebaseConfigComplete } from "@/lib/firebase";

/**
 * ブラウザに埋め込まれた env が空かどうか（変数名だけ表示）。
 * Next.js は `process.env[動的なキー]` をクライアントに埋め込まないため、必ずリテラルで参照する。
 */
function missingFirebasePublicEnvKeys(): string[] {
  const entries: [string, string | undefined][] = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID],
    ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET],
    [
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID],
  ];
  return entries.filter(([, v]) => v === undefined || v === "").map(([k]) => k);
}

export function FirebaseStatus() {
  const app = getFirebaseApp();
  const ready = isFirebaseConfigComplete() && Boolean(app);

  if (!ready) {
    const missingCount = missingFirebasePublicEnvKeys().length;
    return <p className="text-sm text-amber-700">開発設定が未完了です（不足項目: {missingCount}）。</p>;
  }

  return (
    <p className="text-sm text-emerald-800 dark:text-emerald-200">
      Firebase クライアントは初期化できました（次は Authentication / Firestore を有効化）。
    </p>
  );
}
