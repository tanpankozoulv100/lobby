"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  ensureUserProfile,
  subscribeUserProfile,
  updateUserProfile,
} from "@/lib/firestore-users";
import { JAPAN_PREFECTURES } from "@/lib/lobby-profile";
import { isFirebaseConfigComplete } from "@/lib/firebase";

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-24 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

function ProfileConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">プロフィール</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        接続できませんでした。しばらく経ってからお試しください。
      </p>
    </section>
  );
}

function DashboardProfileLoaded({ user }: { user: User }) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        await ensureUserProfile(user.uid, user.email);
      } catch {
        if (!cancelled) setError("プロフィールの初期化に失敗しました。");
        return;
      }
      if (cancelled) return;
      unsub = subscribeUserProfile(
        user.uid,
        (data) => {
          if (cancelled) return;
          setError(null);
          setDisplayName(data?.displayName ?? "");
          setBio(data?.bio ?? "");
          setPrefecture(data?.prefecture ?? "");
          setReady(true);
        },
        (msg) => {
          if (!cancelled) setError(msg);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user.uid, user.email]);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    setError(null);
    setSaving(true);
    const result = await updateUserProfile(user.uid, displayName, bio, prefecture);
    setSaving(false);
    if (result.ok) {
      setSaveMessage("保存しました。");
    } else {
      setError(result.message);
    }
  }, [user.uid, displayName, bio, prefecture]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">プロフィール</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        表示名と自己紹介はのちのマッチング・イベント表示で使う想定です。
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}
      {saveMessage ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {saveMessage}
        </p>
      ) : null}
      <div className="mt-4">
        {!ready && !error ? (
          <ProfileSkeleton />
        ) : ready ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-display-name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                表示名
              </label>
              <input
                id="profile-display-name"
                type="text"
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-[var(--lobby-cream)] px-3 py-2 text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label htmlFor="profile-prefecture" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                居住地（都道府県）
              </label>
              <select
                id="profile-prefecture"
                className="w-full rounded-lg border border-zinc-300 bg-[var(--lobby-cream)] px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
              >
                <option value="">選択してください</option>
                {JAPAN_PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="profile-bio" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                自己紹介（任意）
              </label>
              <textarea
                id="profile-bio"
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full resize-y rounded-lg border border-zinc-300 bg-[var(--lobby-cream)] px-3 py-2 text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <p className="mt-1 text-right text-xs text-zinc-500">{bio.length} / 500</p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardProfileSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <ProfileConfigMissing />;
  }
  return <DashboardProfileLoaded user={user} />;
}
