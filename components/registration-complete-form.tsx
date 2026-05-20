"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { createInitialUserProfile } from "@/lib/firestore-users";
import type { LobbyGender } from "@/lib/lobby-firestore-types";
import {
  ProfileRegistrationFields,
  type ProfileRegistrationValues,
} from "@/components/profile-registration-fields";

export function RegistrationCompleteForm({ user }: { user: User }) {
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

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none transition focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (profile.gender !== "male" && profile.gender !== "female") {
      setError("性別を選択してください。");
      return;
    }
    setPending(true);
    const res = await createInitialUserProfile(user.uid, {
      legalName: profile.legalName,
      displayName: profile.displayName,
      gender: profile.gender as LobbyGender,
      birthYear: profile.birthYear,
      birthMonth: profile.birthMonth,
      birthDay: profile.birthDay,
      prefecture: profile.prefecture,
    });
    setPending(false);
    if (!res.ok) setError(res.message);
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5">
      <h2 className="font-semibold text-zinc-900">プロフィールの登録が必要です</h2>
      <p className="mt-1 text-sm text-zinc-600">
        本人確認・チケット登録の前に、次の情報を入力してください。
      </p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        <ProfileRegistrationFields
          values={profile}
          onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
          inputClass={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "保存中…" : "プロフィールを保存"}
        </button>
      </form>
    </section>
  );
}
