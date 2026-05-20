"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigComplete } from "@/lib/firebase";
import { createInitialUserProfile } from "@/lib/firestore-users";
import type { LobbyGender } from "@/lib/lobby-firestore-types";
import {
  ProfileRegistrationFields,
  type ProfileRegistrationValues,
} from "@/components/profile-registration-fields";
import { useRedirectIfAuthed } from "@/lib/use-redirect-if-authed";

export function SignupForm() {
  const { busy: redirectBusy } = useRedirectIfAuthed();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<ProfileRegistrationValues>({
    legalName: "",
    displayName: "",
    gender: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    prefecture: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (redirectBusy) {
    return <p className="text-sm text-zinc-500">移動中…</p>;
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none transition focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25";

  if (!isFirebaseConfigComplete()) {
    return <p className="text-sm text-zinc-600">現在アカウント登録をご利用いただけません。</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    if (profile.gender !== "male" && profile.gender !== "female") {
      setError("性別を選択してください。");
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setError("接続できませんでした。ページを再読み込みしてください。");
      return;
    }

    setPending(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const profileRes = await createInitialUserProfile(cred.user.uid, {
        legalName: profile.legalName,
        displayName: profile.displayName,
        gender: profile.gender as LobbyGender,
        birthYear: profile.birthYear,
        birthMonth: profile.birthMonth,
        birthDay: profile.birthDay,
        prefecture: profile.prefecture,
      });
      if (!profileRes.ok) {
        setError(profileRes.message);
        return;
      }
      router.replace("/onboarding");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800">アカウント</h2>
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
      </section>

      <section className="space-y-4 border-t border-zinc-200 pt-6">
        <h2 className="text-sm font-semibold text-zinc-800">プロフィール</h2>
        <p className="text-xs text-zinc-500">
          本名・性別・生年月日は登録後に変更できません（本人確認・チケット照合に使用します）。
        </p>
        <ProfileRegistrationFields
          values={profile}
          onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
          inputClass={inputClass}
        />
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--lobby-red-hover)] disabled:opacity-60"
      >
        {pending ? "登録中…" : "登録して次へ（本人確認）"}
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
