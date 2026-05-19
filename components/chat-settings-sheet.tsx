"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  blockPeer,
  submitUserReport,
  unblockPeer,
  USER_REPORT_REASON_CODES,
} from "@/lib/firestore-safety";
import type { UserReportReasonCode } from "@/lib/lobby-firestore-types";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";

const REPORT_LABEL: Record<UserReportReasonCode, string> = {
  harassment: "嫌がらせ・脅迫",
  spam: "スパム・広告",
  inappropriate: "不適切な内容",
  other: "その他",
};

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
  isBlocked: boolean;
  onBlockChange?: () => void;
};

export function ChatSettingsSheet({
  open,
  onClose,
  myUid,
  peerUid,
  peerDisplayName,
  isBlocked,
  onBlockChange,
}: Props) {
  const [view, setView] = useState<"menu" | "profile" | "report">("menu");
  const [peerBio, setPeerBio] = useState<string | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<UserReportReasonCode>("other");
  const [reportNote, setReportNote] = useState("");
  const [reportPending, setReportPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setView("menu");
      setStatus(null);
      return;
    }
    const db = getFirebaseDb();
    if (!db) return;
    void getDoc(doc(db, "users", peerUid)).then((snap) => {
      const bio = snap.data()?.bio;
      setPeerBio(typeof bio === "string" && bio.trim() ? bio.trim() : null);
    });
  }, [open, peerUid]);

  const handleBlock = useCallback(async () => {
    setBlockBusy(true);
    setStatus(null);
    const res = isBlocked ? await unblockPeer(myUid, peerUid) : await blockPeer(myUid, peerUid);
    setBlockBusy(false);
    if (res.ok) {
      setStatus(isBlocked ? "ブロックを解除しました。" : "ブロックしました。");
      onBlockChange?.();
    } else {
      setStatus(res.message);
    }
  }, [myUid, peerUid, isBlocked, onBlockChange]);

  const handleReport = useCallback(async () => {
    setReportPending(true);
    setStatus(null);
    const res = await submitUserReport({
      reporterUid: myUid,
      reportedUid: peerUid,
      reasonCode: reportReason,
      note: reportNote,
    });
    setReportPending(false);
    if (res.ok) {
      setStatus("通報を受け付けました。");
      setView("menu");
      setReportNote("");
    } else {
      setStatus(res.message);
    }
  }, [myUid, peerUid, reportReason, reportNote]);

  const title =
    view === "profile" ? "プロフィール" : view === "report" ? "ユーザー通報" : "設定";

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
            onClick={() => setView("profile")}
          />
          <SettingsRow
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                <path d="M7 12h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            }
            label={isBlocked ? "ブロック解除" : "ブロックする"}
            onClick={() => void handleBlock()}
          />
          {blockBusy ? <p className="pb-2 text-center text-xs text-zinc-500">処理中…</p> : null}
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
            onClick={() => setStatus("通知設定は今後のアップデートで追加予定です。")}
          />
          <SettingsRow
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            label="ユーザー通報"
            labelClassName="text-[var(--lobby-red)]"
            onClick={() => setView("report")}
          />
        </nav>
      ) : null}

      {view === "profile" ? (
        <div className="space-y-3 pt-1">
          <p className="text-lg font-semibold text-zinc-900">{peerDisplayName}</p>
          {peerBio ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{peerBio}</p>
          ) : (
            <p className="text-sm text-zinc-500">自己紹介は未設定です。</p>
          )}
          <button
            type="button"
            onClick={() => setView("menu")}
            className="mt-2 w-full rounded-xl border border-zinc-200 py-2.5 text-sm text-zinc-700"
          >
            戻る
          </button>
        </div>
      ) : null}

      {view === "report" ? (
        <div className="space-y-2 pt-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600">理由</label>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value as UserReportReasonCode)}
            className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
          >
            {USER_REPORT_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {REPORT_LABEL[code]}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            maxLength={500}
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="補足（任意）"
            className="mt-2 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={reportPending}
            onClick={() => void handleReport()}
            className="mt-3 w-full rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {reportPending ? "送信中…" : "通報を送信"}
          </button>
          <button
            type="button"
            onClick={() => setView("menu")}
            className="w-full py-2 text-sm text-zinc-500"
          >
            戻る
          </button>
        </div>
      ) : null}
    </LobbyBottomSheet>
  );
}
