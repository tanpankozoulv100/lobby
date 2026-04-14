"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigComplete } from "@/lib/firebase";
import { useRedirectIfAuthed } from "@/lib/use-redirect-if-authed";

export function SignupForm() {
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
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase が初期化できていません。ページを再読み込みしてください。");
      return;
    }
    setPending(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/email-already-in-use") {
        setError("このメールアドレスは既に登録されています。");
      } else if (code === "auth/weak-password") {
        setError("パスワードが弱すぎます。別のパスワードを試してください。");
      } else if (code === "auth/invalid-email") {
        setError("メールアドレスの形式が正しくありません。");
      } else {
        setError("登録に失敗しました。もう一度お試しください。");
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
        <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-zinc-700">
          メールアドレス
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-zinc-700">
          パスワード（8文字以上）
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        {pending ? "登録中…" : "アカウントを作成"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        既にアカウントがある方は{" "}
        <Link href="/login" className="font-medium text-[var(--lobby-red)] underline underline-offset-2">
          ログイン
        </Link>
      </p>
    </form>
  );
}
