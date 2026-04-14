"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { LobbyPageShell } from "@/components/lobby-page-shell";

const FirebaseStatus = dynamic(
  () =>
    import("@/components/firebase-status").then((m) => ({
      default: m.FirebaseStatus,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-zinc-500">Firebase 接続を確認しています…</p>
    ),
  }
);

export function HomeWithFirebase() {
  const { user, loading } = useAuth();

  return (
    <LobbyPageShell>
      <div className="w-full space-y-6 text-center">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-zinc-900">トップ</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            メールでログインできます。Firebase Console で「Authentication」→「メール／パスワード」を有効にしてください。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {loading ? (
            <span className="text-sm text-zinc-500">認証状態を確認中…</span>
          ) : user ? (
            <Link
              href="/dashboard"
              className="inline-flex justify-center rounded-xl bg-[var(--lobby-red)] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--lobby-red-hover)]"
            >
              ダッシュボードへ
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex justify-center rounded-xl bg-[var(--lobby-red)] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--lobby-red-hover)]"
              >
                ログイン
              </Link>
              <Link
                href="/signup"
                className="inline-flex justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                新規登録
              </Link>
            </>
          )}
        </div>

        <div className="border-t border-zinc-100 pt-6 text-left">
          <FirebaseStatus />
        </div>
      </div>
    </LobbyPageShell>
  );
}
