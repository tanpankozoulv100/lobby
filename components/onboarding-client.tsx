"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import { redeemSeasonTicket } from "@/lib/firestore-tickets";
import { submitIdentityDocument } from "@/lib/identity-upload";
import { normalizeSeasonTicketCode } from "@/lib/ticket-code";
import {
  getPostLobbyEntryPath,
  isLobbyAccessGranted,
  isOnboardingBypassActiveForUser,
} from "@/lib/onboarding-status";
import { useLobbyStaff } from "@/lib/use-lobby-staff";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import { GENDER_LABELS, formatBirthDateJa, hasRequiredRegistrationFields } from "@/lib/lobby-profile";
import { getProfileAge } from "@/lib/firestore-users";
import { RegistrationCompleteForm } from "@/components/registration-complete-form";
import Link from "next/link";

function statusLabel(identityStatus: UserProfileFields["identityStatus"]): string {
  switch (identityStatus) {
    case "pending":
      return "確認中";
    case "approved":
      return "承認済み";
    case "rejected":
      return "差し戻し（再提出できます）";
    default:
      return "未提出";
  }
}

export function OnboardingClient({ user }: { user: User }) {
  const router = useRouter();
  const { isStaff, staffGateReady } = useLobbyStaff(user.uid);
  const bypassCtx = { isLobbyStaff: isStaff };
  const [profile, setProfile] = useState<UserProfileFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [ticketRaw, setTicketRaw] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    void (async () => {
      if (!isFirebaseConfigComplete()) {
        if (!cancelled) {
          setError("Firebase の設定を確認してください。");
          setLoading(false);
        }
        return;
      }
      try {
        await ensureUserProfile(user.uid, user.email);
      } catch (e) {
        console.error("[Lobby] onboarding ensureUserProfile:", e);
        if (!cancelled) {
          setError("プロフィールの準備に失敗しました。");
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      unsub = subscribeUserProfile(
        user.uid,
        (p) => {
          if (cancelled) return;
          setProfile(p);
          setError(null);
          setLoading(false);
        },
        (msg) => {
          if (cancelled) return;
          setError(msg);
          setLoading(false);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user.uid, user.email]);

  useEffect(() => {
    if (!staffGateReady) return;
    if (isOnboardingBypassActiveForUser(user.uid, bypassCtx)) {
      router.replace(getPostLobbyEntryPath(profile, user.uid, bypassCtx));
    }
  }, [router, user.uid, staffGateReady, isStaff, profile]);

  useEffect(() => {
    if (!staffGateReady || loading || !profile) return;
    if (isLobbyAccessGranted(profile, user.uid, bypassCtx)) {
      router.replace(getPostLobbyEntryPath(profile, user.uid, bypassCtx));
    }
  }, [loading, profile, router, user.uid, staffGateReady, isStaff]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    const res = await submitIdentityDocument(user.uid, file);
    setUploadBusy(false);
    if (!res.ok) {
      setError(res.message);
    }
  };

  const handleTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketMessage(null);
    setTicketBusy(true);
    const res = await redeemSeasonTicket(user.uid, ticketRaw);
    setTicketBusy(false);
    if (res.ok) {
      setTicketRaw("");
      setTicketMessage("登録しました。");
    } else {
      setTicketMessage(res.message);
    }
  };

  if (loading && !error) {
    return <p className="text-center text-sm text-zinc-500">読み込み中…</p>;
  }

  if (error && !profile) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        プロフィールを読み込めませんでした。
      </div>
    );
  }

  if (!hasRequiredRegistrationFields(profile)) {
    return (
      <div className="space-y-6 text-left">
        <div>
          <h1 className="font-serif text-xl font-semibold text-zinc-900">プロフィール登録</h1>
          <p className="mt-2 text-sm text-zinc-600">
            本人確認・チケット登録の前に、本名・性別・生年月日などを登録してください。
          </p>
        </div>
        <RegistrationCompleteForm user={user} />
      </div>
    );
  }

  const idStatus = profile.identityStatus ?? "none";
  const profileAge = getProfileAge(profile);
  const canUploadIdentity =
    idStatus === "none" ||
    idStatus === "rejected" ||
    (idStatus === "pending" && !profile.idDocumentPath);

  return (
    <div className="space-y-8 text-left">
      <div>
        <h1 className="font-serif text-xl font-semibold text-zinc-900">利用開始の確認</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          登録済みの性別・生年月日と、Shopify で購入したチケット区分が一致することを確認します。続いて本人確認の書類提出、シリアル番号入力の順です。
        </p>
        {profile.gender ? (
          <p className="mt-2 text-xs text-zinc-500">
            登録プロフィール: {profile.legalName ? `${profile.legalName} · ` : ""}
            {GENDER_LABELS[profile.gender]}
            {profile.birthDate ? ` · ${formatBirthDateJa(profile.birthDate)}` : ""}
            {profileAge != null ? `（${profileAge}歳）` : ""}
            {profile.prefecture ? ` · ${profile.prefecture}` : ""}
          </p>
        ) : null}
        {!isStaff && staffGateReady ? (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-600">
            運営・テスト用アカウントは、Firebase Console の Authentication で登録メールを確認し、同じ UID で{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono">admins</code> コレクションにドキュメントを 1 件追加すると本人確認・チケットを省略できます。
            {user.email ? (
              <span className="mt-2 block text-zinc-700">登録メール: {user.email}</span>
            ) : null}
          </p>
        ) : null}
        {isStaff ? (
          <p className="mt-3 text-xs font-medium text-emerald-800">運営スタッフとして登録済みです。ダッシュボードへ移動します…</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
        <h2 className="text-sm font-semibold text-zinc-900">1. 本人確認（顔写真付き書類）</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          次のいずれか、<strong>顔写真が写っている本人確認書類</strong>の写真を1枚アップロードしてください。
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-zinc-600">
          <li>運転免許証</li>
          <li>マイナンバーカード（顔写真がある面）</li>
          <li>パスポート（顔写真ページ）</li>
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          登録した本名と書類の記載が一致しているか、運営が目視で確認します。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          提出画像と受領日時は法令に基づき3年間保管します（詳細は利用規約・プライバシーポリシーに準じます）。
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--lobby-red)]">状態: {statusLabel(profile.identityStatus)}</p>
        {idStatus === "pending" && profile.idDocumentPath ? (
          <p className="mt-2 text-xs text-zinc-600">提出済みです。結果が出るまでお待ちください。</p>
        ) : null}
        {canUploadIdentity ? (
          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[var(--lobby-red)] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[var(--lobby-red-hover)] disabled:opacity-50">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploadBusy}
                onChange={handleFile}
              />
              {uploadBusy ? "アップロード中…" : "画像を選ぶ"}
            </label>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
        <h2 className="text-sm font-semibold text-zinc-900">2. シーズンチケット（シリアル番号）</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          ショップで購入したチケットに記載のコードを入力してください。男性用・女性用で価格が異なるため、登録性別（
          {profile.gender ? GENDER_LABELS[profile.gender] : "—"}）と一致するチケットのみ有効です。
        </p>
        {profile.ticketRedeemedAt ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">
            登録済み（{profile.seasonTicketCode ?? "コード記録あり"}）
          </p>
        ) : (
          <form onSubmit={handleTicket} className="mt-4 space-y-3">
            <input
              type="text"
              name="ticket"
              autoComplete="off"
              value={ticketRaw}
              onChange={(ev) => setTicketRaw(ev.target.value)}
              placeholder="例: nagoya202601xabcd"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-[var(--lobby-red)] focus:ring-2"
            />
            <button
              type="submit"
              disabled={ticketBusy || normalizeSeasonTicketCode(ticketRaw).length < 8}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {ticketBusy ? "確認中…" : "シリアルを登録"}
            </button>
            {ticketMessage ? <p className="text-sm text-zinc-700">{ticketMessage}</p> : null}
          </form>
        )}
      </section>

      <div className="border-t border-zinc-100 pt-4 text-center text-xs text-zinc-500">
        <Link href="/" className="text-[var(--lobby-red)] underline-offset-2 hover:underline">
          トップへ
        </Link>
      </div>
    </div>
  );
}
