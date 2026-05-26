"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";
import {
  ensureUserProfile,
  subscribeUserProfile,
  updateUserProfile,
  updateUserProfilePresentation,
} from "@/lib/firestore-users";
import { GENDER_LABELS, JAPAN_PREFECTURES, formatBirthDateJa } from "@/lib/lobby-profile";
import type { LobbyGender } from "@/lib/lobby-firestore-types";
import {
  COMPATIBILITY_QUESTIONS,
  countAnsweredQuestions,
  type CompatibilityAnswers,
  type CompatibilityQuestionId,
} from "@/lib/compatibility-questions";
import { uploadProfileMedia } from "@/lib/profile-media-upload";
import { useProfileMediaUrl } from "@/lib/use-profile-media-url";

function MediaAddButton({
  label,
  onPick,
  disabled,
}: {
  label: string;
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-1">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lobby-red)] text-lg font-medium text-white">
        +
      </span>
      <span className="text-[10px] text-zinc-500">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function ProfileEditSheet({
  user,
  open,
  onClose,
  previewDisplayName,
}: {
  user: User;
  open: boolean;
  onClose: () => void;
  previewDisplayName: string;
}) {
  const [displayName, setDisplayName] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [answers, setAnswers] = useState<CompatibilityAnswers>({});
  const [avatarPath, setAvatarPath] = useState<string | undefined>();
  const [coverPath, setCoverPath] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const avatarUrl = useProfileMediaUrl(avatarPath);
  const coverUrl = useProfileMediaUrl(coverPath);

  useEffect(() => {
    if (!open) {
      setPreviewMode(false);
      return;
    }
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void ensureUserProfile(user.uid, user.email).then(() => {
      unsub = subscribeUserProfile(
        user.uid,
        (data) => {
          if (cancelled) return;
          setDisplayName(data?.displayName ?? "");
          setPrefecture(data?.prefecture ?? "");
          setLegalName(data?.legalName ?? "");
          setGender(data?.gender ?? "");
          setBio(data?.bio ?? "");
          setBirthDate(data?.birthDate ?? "");
          setAnswers(data?.compatibilityAnswers ?? {});
          setAvatarPath(data?.avatarPath);
          setCoverPath(data?.coverPath);
          setReady(true);
        },
        (msg) => {
          if (!cancelled) setError(msg);
        }
      );
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [open, user.uid, user.email]);

  const answeredCount = useMemo(() => countAnsweredQuestions(answers), [answers]);

  const setAnswer = useCallback((qid: CompatibilityQuestionId, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));
  }, []);

  const handleMedia = useCallback(
    async (kind: "avatar" | "cover", file: File) => {
      setError(null);
      setUploading(true);
      const result = await uploadProfileMedia(user.uid, kind, file);
      setUploading(false);
      if (result.ok) {
        if (kind === "avatar") setAvatarPath(result.path);
        else setCoverPath(result.path);
      } else {
        setError(result.message);
      }
    },
    [user.uid]
  );

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    setError(null);
    setSaving(true);
    const accountResult = await updateUserProfile(user.uid, displayName, bio, prefecture);
    if (!accountResult.ok) {
      setSaving(false);
      setError(accountResult.message);
      return;
    }
    const compatResult = await updateUserProfilePresentation(user.uid, bio, answers);
    setSaving(false);
    if (compatResult.ok) {
      setSaveMessage("保存しました。");
      setPreviewMode(false);
    } else {
      setError(compatResult.message);
    }
  }, [user.uid, displayName, bio, prefecture, answers]);

  const previewInitial = (displayName.trim() || previewDisplayName).slice(0, 1) || "?";

  return (
    <LobbyBottomSheet open={open} title="プロフィール編集" onClose={onClose} tall>
      <div className="space-y-5 pt-1 pb-6">
        {error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p> : null}
        {saveMessage ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{saveMessage}</p>
        ) : null}

        {previewMode ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            <div
              className="h-24 bg-gradient-to-br from-[var(--lobby-red)]/25 to-zinc-200 bg-cover bg-center"
              style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
            />
            <div className="-mt-10 flex flex-col items-center px-4 pb-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full border-4 border-[var(--lobby-cream)] object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--lobby-cream)] bg-[var(--lobby-surface-raised)] text-xl font-semibold text-[var(--lobby-red)]">
                  {previewInitial}
                </div>
              )}
              <p className="mt-2 font-bold text-zinc-900">{displayName.trim() || previewDisplayName}</p>
              {bio.trim() ? <p className="mt-2 text-center text-sm text-zinc-600">{bio.trim()}</p> : null}
              <p className="mt-2 text-xs text-zinc-500">相性質問 {answeredCount}/12 回答済み</p>
            </div>
          </div>
        ) : null}

        {ready ? (
          <>
            {!previewMode ? (
              <>
                <div className="flex items-start justify-center gap-10">
                  <div className="flex flex-col items-center">
                    <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl text-zinc-400">{previewInitial}</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <MediaAddButton
                        label="プロフィール写真"
                        disabled={uploading}
                        onPick={(f) => void handleMedia("avatar", f)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className="h-20 w-20 overflow-hidden rounded-full bg-zinc-100 bg-cover bg-center"
                      style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
                    />
                    <div className="mt-2">
                      <MediaAddButton
                        label="背景画像"
                        disabled={uploading}
                        onPick={(f) => void handleMedia("cover", f)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-3">
                  <p className="text-xs font-semibold text-zinc-700">アカウント</p>
                  <div>
                    <label htmlFor="profile-display-name" className="mb-1 block text-xs font-medium text-zinc-600">
                      表示名
                    </label>
                    <input
                      id="profile-display-name"
                      type="text"
                      maxLength={50}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-prefecture" className="mb-1 block text-xs font-medium text-zinc-600">
                      居住地（都道府県）
                    </label>
                    <select
                      id="profile-prefecture"
                      className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
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
                  <div className="text-xs text-zinc-600">
                    <p>本名: {legalName || "—"}（変更不可）</p>
                    <p className="mt-1">
                      性別:{" "}
                      {gender === "male" || gender === "female"
                        ? GENDER_LABELS[gender as LobbyGender]
                        : "—"}
                      （変更不可）
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    生年月日 <span className="text-[var(--lobby-red)]">*</span>
                  </label>
                  <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                    {formatBirthDateJa(birthDate) || "—"}
                    <span className="ml-2 text-xs text-zinc-500">（変更不可）</span>
                  </p>
                </div>

                <div>
                  <label htmlFor="profile-bio" className="mb-1 block text-xs font-medium text-zinc-600">
                    みんなへのひとこと
                  </label>
                  <input
                    id="profile-bio"
                    type="text"
                    maxLength={500}
                    placeholder="メッセージを入力してください"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">相性質問</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    全12問に答えると、マッチした相手との一致率が表示されます（{answeredCount}/12）
                  </p>
                  <ul className="mt-3 space-y-4">
                    {COMPATIBILITY_QUESTIONS.map((q, idx) => (
                      <li key={q.id}>
                        <label htmlFor={`compat-${q.id}`} className="mb-1 block text-xs font-medium text-zinc-700">
                          Q{idx + 1}. {q.label}
                        </label>
                        <select
                          id={`compat-${q.id}`}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
                        >
                          <option value="">未選択</option>
                          {q.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode((p) => !p)}
                className="w-full rounded-full border-2 border-[var(--lobby-red)] bg-white py-3 text-sm font-medium text-[var(--lobby-red)]"
              >
                {previewMode ? "編集に戻る" : "プレビューで確認"}
              </button>
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => void handleSave()}
                className="w-full rounded-full bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存する"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        )}
      </div>
    </LobbyBottomSheet>
  );
}
