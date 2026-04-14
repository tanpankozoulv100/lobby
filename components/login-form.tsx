"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigComplete } from "@/lib/firebase";
import { useRedirectIfAuthed } from "@/lib/use-redirect-if-authed";

export function LoginForm() {
  const { busy: redirectBusy } = useRedirectIfAuthed();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (redirectBusy) {
    return <p className="text-sm text-zinc-500">移動中…</p>;
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none transition focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25";

  if (!isFirebaseConfigComplete()) {
    return (
      <p className="text-sm text-amber-800 dark:text-amber-200">
        先に <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">.env.local</code>{" "}
        に Firebase の設定を入れてください。
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase が初期化できていません。ページを再読み込みしてください。");
      return;
    }
    setPending(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("メールアドレスまたはパスワードが正しくありません。");
      } else if (code === "auth/too-many-requests") {
        setError("試行回数が多すぎます。しばらく待ってから再度お試しください。");
      } else {
        setError("ログインに失敗しました。もう一度お試しください。");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-zinc-700">
          メールアドレス
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-zinc-700">
          パスワード
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--lobby-red-hover)] disabled:opacity-60"
      >
        {pending ? "ログイン中…" : "ログイン"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        アカウントがない方は{" "}
        <Link href="/signup" className="font-medium text-[var(--lobby-red)] underline underline-offset-2">
          新規登録
        </Link>
      </p>
    </form>
  );
}
