"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/firestore-users";
import { redeemSeasonTicket } from "@/lib/firestore-tickets";
import { submitIdentityDocument } from "@/lib/identity-upload";
import { normalizeSeasonTicketCode } from "@/lib/ticket-code";
import { isDevOnboardingBypassEnabled, isLobbyAccessGranted } from "@/lib/onboarding-status";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
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
    if (isDevOnboardingBypassEnabled()) {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (loading || !profile) return;
    if (isLobbyAccessGranted(profile)) {
      router.replace("/dashboard");
    }
  }, [loading, profile, router]);

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

  const idStatus = profile.identityStatus ?? "none";
  const canUploadIdentity =
    idStatus === "none" ||
    idStatus === "rejected" ||
    (idStatus === "pending" && !profile.idDocumentPath);

  return (
    <div className="space-y-8 text-left">
      <div>
        <h1 className="font-serif text-xl font-semibold text-zinc-900">利用開始の確認</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          ショップで購入したシーズンチケットのシリアルと、本人確認用の書類をご用意ください。運営が書類を確認するまでお時間がかかる場合があります。
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
        <h2 className="text-sm font-semibold text-zinc-900">1. 本人確認（書類の写真）</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          顔写真付きの身分証（運転免許証・マイナンバーカード等）をアップロードしてください。運営の確認で承認されると、次の手順に進めます。
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
          ショップで購入したチケットに記載のコードを入力してください（ハイフンはあってもなくても構いません）。
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
              placeholder="例: LOBBY-XXXX-YYYY"
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
