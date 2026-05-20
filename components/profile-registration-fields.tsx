"use client";

import type { LobbyGender } from "@/lib/lobby-firestore-types";
import { GENDER_LABELS, JAPAN_PREFECTURES } from "@/lib/lobby-profile";

export type ProfileRegistrationValues = {
  legalName: string;
  displayName: string;
  gender: LobbyGender | "";
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  prefecture: string;
};

type Props = {
  values: ProfileRegistrationValues;
  onChange: (patch: Partial<ProfileRegistrationValues>) => void;
  inputClass: string;
  /** 性別・生年月日を編集不可表示にする */
  lockImmutable?: boolean;
};

export function ProfileRegistrationFields({ values, onChange, inputClass, lockImmutable = false }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="reg-legal-name" className="mb-1 block text-sm font-medium text-zinc-700">
          本名
        </label>
        {lockImmutable ? (
          <p className="text-sm text-zinc-600">{values.legalName || "—"}（変更不可）</p>
        ) : (
          <>
            <input
              id="reg-legal-name"
              required
              maxLength={40}
              autoComplete="name"
              className={inputClass}
              value={values.legalName}
              onChange={(e) => onChange({ legalName: e.target.value })}
              placeholder="例: 山田 太郎"
            />
            <p className="mt-1 text-xs text-zinc-500">
              本人確認書類の記載と同じ表記で入力してください。登録後は変更できません。
            </p>
          </>
        )}
      </div>

      <div>
        <label htmlFor="reg-display-name" className="mb-1 block text-sm font-medium text-zinc-700">
          ユーザー名（アプリ内の表示名）
        </label>
        <input
          id="reg-display-name"
          required
          maxLength={50}
          className={inputClass}
          value={values.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          placeholder="例: はなこ"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-zinc-700">性別</span>
        {lockImmutable ? (
          <p className="text-sm text-zinc-600">{values.gender ? GENDER_LABELS[values.gender] : "—"}（変更不可）</p>
        ) : (
          <div className="flex gap-4">
            {(["female", "male"] as const).map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gender"
                  required
                  checked={values.gender === g}
                  onChange={() => onChange({ gender: g })}
                />
                {GENDER_LABELS[g]}
              </label>
            ))}
          </div>
        )}
        {!lockImmutable ? (
          <p className="mt-1 text-xs text-zinc-500">登録後は変更できません。Shopify で購入したチケットの区分と一致させてください。</p>
        ) : null}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-zinc-700">生年月日</span>
        {lockImmutable ? (
          <p className="text-sm text-zinc-600">
            {values.birthYear && values.birthMonth && values.birthDay
              ? `${values.birthYear}年${values.birthMonth}月${values.birthDay}日`
              : "—"}
            （変更不可）
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                required
                inputMode="numeric"
                className={`${inputClass} w-24`}
                placeholder="年"
                value={values.birthYear}
                onChange={(e) => onChange({ birthYear: e.target.value })}
              />
              <input
                required
                inputMode="numeric"
                className={`${inputClass} w-16`}
                placeholder="月"
                value={values.birthMonth}
                onChange={(e) => onChange({ birthMonth: e.target.value })}
              />
              <input
                required
                inputMode="numeric"
                className={`${inputClass} w-16`}
                placeholder="日"
                value={values.birthDay}
                onChange={(e) => onChange({ birthDay: e.target.value })}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">18歳以上のみ。登録後は変更できません。</p>
          </>
        )}
      </div>

      <div>
        <label htmlFor="reg-prefecture" className="mb-1 block text-sm font-medium text-zinc-700">
          居住地（都道府県）
        </label>
        <select
          id="reg-prefecture"
          required
          className={inputClass}
          value={values.prefecture}
          onChange={(e) => onChange({ prefecture: e.target.value })}
        >
          <option value="">選択してください</option>
          {JAPAN_PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">マイページから後で変更できます。</p>
      </div>
    </div>
  );
}
