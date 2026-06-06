"use client";

import { useCallback, useEffect, useState } from "react";
import { reportPeer, USER_REPORT_REASON_CODES, USER_REPORT_REASON_LABEL } from "@/lib/firestore-safety";
import type { UserReportReasonCode } from "@/lib/lobby-firestore-types";
import { subscribeChatPref, setDmNotifyEnabled } from "@/lib/firestore-chat-prefs";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";
import { LobbyOptionPicker } from "@/components/lobby-option-picker";

function SettingsRow({
  icon,
  label,
  labelClassName,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  labelClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-zinc-200/60 py-4 text-left last:border-b-0"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-zinc-600">{icon}</span>
      <span className={`flex-1 text-sm font-medium ${labelClassName ?? "text-zinc-900"}`}>{label}</span>
      <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  myUid: string;
  peerUid: string;
  peerDisplayName: string;
  onOpenPeerProfile: () => void;
};

export function ChatSettingsSheet({
  open,
  onClose,
  myUid,
  peerUid,
  peerDisplayName,
  onOpenPeerProfile,
}: Props) {
  const [view, setView] = useState<"menu" | "notify" | "report">("menu");
  const [dmNotifyEnabled, setDmNotifyEnabledState] = useState(true);
  const [notifySaving, setNotifySaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<UserReportReasonCode>("other");
  const [note, setNote] = useState("");
  const [submitPending, setSubmitPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setView("menu");
      setStatus(null);
      return;
    }
    const unsub = subscribeChatPref(myUid, peerUid, (pref) => {
      setDmNotifyEnabledState(pref.dmNotifyEnabled);
    });
    return () => unsub?.();
  }, [open, myUid, peerUid]);

  const handleToggleNotify = useCallback(async () => {
    const next = !dmNotifyEnabled;
    setNotifySaving(true);
    setStatus(null);
    const res = await setDmNotifyEnabled(myUid, peerUid, next);
    setNotifySaving(false);
    if (res.ok) {
      setDmNotifyEnabledState(next);
      setStatus(next ? "この相手の DM 通知をオンにしました。" : "この相手の DM 通知をオフにしました。");
    } else {
      setStatus(res.message);
    }
  }, [myUid, peerUid, dmNotifyEnabled]);

  const handleReport = useCallback(async () => {
    setSubmitPending(true);
    setStatus(null);
    const res = await reportPeer({
      myUid,
      peerUid,
      reasonCode,
      note,
    });
    setSubmitPending(false);
    if (res.ok) {
      setStatus("通報を受け付けました。運営が内容を確認します。");
      setView("menu");
      setNote("");
    } else {
      setStatus(res.message);
    }
  }, [myUid, peerUid, reasonCode, note]);

  const title =
    view === "notify" ? "DM通知設定" : view === "report" ? "通報" : "設定";

  return (
    <LobbyBottomSheet
      open={open}
      title={title}
      onClose={() => {
        onClose();
        setView("menu");
      }}
    >
      {status ? <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{status}</p> : null}

      {view === "menu" ? (
        <nav className="-mx-1">
          <SettingsRow
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
                <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            }
            label="プロフィールを見る"
            onClick={() => {
              onClose();
              onOpenPeerProfile();
            }}
          />
          <SettingsRow
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3a5 5 0 00-5 5v1.5L5 14v3h14v-3l-2-4.5V8a5 5 0 00-5-5z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
              </svg>
            }
            label="DM通知設定"
            onClick={() => setView("notify")}
          />
          <SettingsRow
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            label="通報する"
            labelClassName="text-[var(--lobby-red)]"
            onClick={() => setView("report")}
          />
        </nav>
      ) : null}

      {view === "notify" ? (
        <div className="space-y-4 pt-1">
          <p className="text-sm text-zinc-700">
            {peerDisplayName} さんとのレターについて、通知を個別に設定できます。
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <span className="text-sm font-medium text-zinc-900">DM 通知</span>
            <button
              type="button"
              role="switch"
              aria-checked={dmNotifyEnabled}
              disabled={notifySaving}
              onClick={() => void handleToggleNotify()}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                dmNotifyEnabled ? "bg-[var(--lobby-red)]" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  dmNotifyEnabled ? "left-[1.35rem]" : "left-0.5"
                }`}
              />
            </button>
          </label>
          <button
            type="button"
            onClick={() => setView("menu")}
            className="w-full rounded-xl border border-zinc-200 py-2.5 text-sm text-zinc-700"
          >
            戻る
          </button>
        </div>
      ) : null}

      {view === "report" ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-zinc-600">
            迷惑行為・嫌がらせなど、運営の対応が必要な場合にご利用ください。相手の自動ブロックは行いません。
          </p>
          <LobbyOptionPicker
            label="理由"
            value={reasonCode}
            options={USER_REPORT_REASON_CODES.map((code) => ({
              value: code,
              label: USER_REPORT_REASON_LABEL[code],
            }))}
            onChange={(v) => setReasonCode(v as UserReportReasonCode)}
          />
          <textarea
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="補足（任意）"
            className="mt-2 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={submitPending}
            onClick={() => void handleReport()}
            className="mt-3 w-full rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitPending ? "送信中…" : "通報を送信"}
          </button>
          <button type="button" onClick={() => setView("menu")} className="w-full py-2 text-sm text-zinc-500">
            戻る
          </button>
        </div>
      ) : null}
    </LobbyBottomSheet>
  );
}
