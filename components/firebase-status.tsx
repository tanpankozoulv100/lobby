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
  const missingKeys = missingFirebasePublicEnvKeys();
  const app = getFirebaseApp();
  const ready = isFirebaseConfigComplete() && Boolean(app);

  if (!ready) {
    return (
      <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
        <p>
          Firebase 未設定です。{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
            lobby-app
          </code>{" "}
          直下の{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
            .env.local
          </code>{" "}
          に値を入れ、
          <strong className="font-medium"> ターミナルで開発サーバーを止めて（Ctrl+C）から </strong>
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">npm run dev</code>{" "}
          をもう一度。まだダメなら{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">.next</code>{" "}
          フォルダを削除してから同じく起動し直してください。
        </p>
        {missingKeys.length > 0 ? (
          <p className="rounded-lg bg-amber-100/80 px-3 py-2 text-xs dark:bg-amber-950/40 dark:text-amber-100">
            いまブラウザに渡っていない変数: {missingKeys.join(", ")}
            <br />
            （<code className="text-[11px]">lobby-app</code> で{" "}
            <code className="text-[11px]">npm run dev</code> しているか確認してください）
          </p>
        ) : (
          <p className="rounded-lg bg-amber-100/80 px-3 py-2 text-xs dark:bg-amber-950/40 dark:text-amber-100">
            環境変数は読めていますが初期化に失敗しています。ブラウザを再読み込みするか、
            <code className="text-[11px]">.next</code> 削除後にサーバー再起動を試してください。
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-emerald-800 dark:text-emerald-200">
      Firebase クライアントは初期化できました（次は Authentication / Firestore を有効化）。
    </p>
  );
}
