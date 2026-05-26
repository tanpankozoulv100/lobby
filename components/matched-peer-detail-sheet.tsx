"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { AnimatedSyncRateRing } from "@/components/animated-sync-rate-ring";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";
import { LobbyOptionPicker } from "@/components/lobby-option-picker";
import { MatchPrivateMemoSheet } from "@/components/match-private-memo-sheet";
import { MatchCompatibilityInline } from "@/components/match-compatibility-inline";
import { computeCompatibilityMatch } from "@/lib/compatibility-match";
import {
  COMPATIBILITY_QUESTIONS,
  getCompatibilityOptionLabel,
  type CompatibilityAnswers,
} from "@/lib/compatibility-questions";
import { formatParticipantNoDisplay } from "@/lib/format-participant-no";
import { fetchUserProfile } from "@/lib/firestore-users";
import type { UserProfileFields } from "@/lib/lobby-firestore-types";
import { useProfileMediaUrl } from "@/lib/use-profile-media-url";
import type { UserReportReasonCode } from "@/lib/lobby-firestore-types";
import {
  reportPeer,
  USER_REPORT_REASON_CODES,
  USER_REPORT_REASON_LABEL,
} from "@/lib/firestore-safety";

export function MatchedPeerDetailSheet({
  open,
  onClose,
  user,
  peerUid,
  encounterCount,
  myAnswers,
  isStaffViewer,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  peerUid: string;
  encounterCount: number;
  myAnswers: CompatibilityAnswers | undefined;
  isStaffViewer?: boolean;
}) {
  const [peer, setPeer] = useState<UserProfileFields | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<UserReportReasonCode>("other");
  const [note, setNote] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const avatarUrl = useProfileMediaUrl(peer?.avatarPath);

  useEffect(() => {
    if (!open || !peerUid) return;
    let cancelled = false;
    void fetchUserProfile(peerUid).then((p) => {
      if (!cancelled) setPeer(p);
    });
    return () => {
      cancelled = true;
    };
  }, [open, peerUid]);

  useEffect(() => {
    if (!open) {
      setReportOpen(false);
      setReportMessage(null);
    }
  }, [open]);

  const displayName = peer?.displayName?.trim() || "ゲスト";
  const noLabel = formatParticipantNoDisplay(peer?.participantNo, false);
  const matchResult = useMemo(
    () => computeCompatibilityMatch(myAnswers, peer?.compatibilityAnswers),
    [myAnswers, peer?.compatibilityAnswers]
  );

  const handleReport = async () => {
    setReportPending(true);
    setReportMessage(null);
    const res = await reportPeer({
      myUid: user.uid,
      peerUid,
      reasonCode,
      note,
    });
    setReportPending(false);
    if (res.ok) {
      setReportMessage("通報を受け付けました。");
      setReportOpen(false);
      setNote("");
    } else {
      setReportMessage(res.message);
    }
  };

  return (
    <>
      <LobbyBottomSheet open={open} title="マッチングした相手" onClose={onClose} tall>
        <div className="space-y-5 pb-6">
          <div className="flex flex-col items-center text-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-200 text-2xl font-semibold text-zinc-600">
                {displayName.slice(0, 1)}
              </div>
            )}
            <p className="mt-3 flex items-baseline justify-center gap-2 text-lg font-bold text-zinc-900">
              <span>{displayName}</span>
              <MatchCompatibilityInline peerUid={peerUid} myAnswers={myAnswers} />
            </p>
            <p className="font-mono text-sm text-zinc-500">No.{noLabel}</p>
            <p className="mt-1 text-sm text-zinc-600">マッチングした回数 {encounterCount}回</p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-5">
            <h3 className="text-center text-sm font-semibold text-zinc-900">あなたとのシンクロ割合</h3>
            <p className="mt-1 text-center text-xs text-zinc-500">
              12問中{matchResult.matchCount}問 意見が一致しました
            </p>
            <div className="mt-4 flex justify-center">
              <AnimatedSyncRateRing
                targetPercent={matchResult.percent}
                animateKey={open ? peerUid : "closed"}
                size={168}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">相性質問の回答</h3>
            <ul className="mt-3 space-y-3">
              {COMPATIBILITY_QUESTIONS.map((q, idx) => {
                const mine = getCompatibilityOptionLabel(q.id, myAnswers?.[q.id]);
                const theirs = getCompatibilityOptionLabel(q.id, peer?.compatibilityAnswers?.[q.id]);
                const same = myAnswers?.[q.id] && myAnswers[q.id] === peer?.compatibilityAnswers?.[q.id];
                return (
                  <li key={q.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                    <p className="text-xs font-medium text-zinc-500">
                      Q{idx + 1}. {q.label}
                    </p>
                    <p className="mt-1 text-sm text-zinc-800">{theirs ?? "未回答"}</p>
                    {mine ? (
                      <p
                        className={`mt-1 text-xs ${same ? "text-[var(--lobby-red)]" : "text-zinc-500"}`}
                      >
                        あなた: {mine}
                        {same ? "（一致）" : ""}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setMemoOpen(true)}
              className="w-full rounded-full border border-zinc-300 py-3 text-sm font-medium text-zinc-800"
            >
              自由メモ（自分だけに表示）
            </button>
            {!isStaffViewer ? (
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="w-full rounded-full border border-rose-200 bg-rose-50 py-3 text-sm font-medium text-rose-900"
              >
                {reportOpen ? "通報フォームを閉じる" : "通報する"}
              </button>
            ) : null}
          </div>

          {reportMessage ? (
            <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{reportMessage}</p>
          ) : null}

          {reportOpen ? (
            <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
              <p className="text-xs text-zinc-600">
                迷惑行為・嫌がらせなど、運営の対応が必要な場合にご利用ください。
              </p>
              <LobbyOptionPicker
                label="通報理由"
                value={reasonCode}
                options={USER_REPORT_REASON_CODES.map((code) => ({
                  value: code,
                  label: USER_REPORT_REASON_LABEL[code],
                }))}
                onChange={(v) => setReasonCode(v as UserReportReasonCode)}
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="補足（任意）"
                className="w-full resize-y rounded-lg border border-zinc-200 px-2 py-2 text-sm"
              />
              <button
                type="button"
                disabled={reportPending}
                onClick={() => void handleReport()}
                className="w-full rounded-lg bg-rose-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {reportPending ? "送信中…" : "通報を送信"}
              </button>
            </div>
          ) : null}
        </div>
      </LobbyBottomSheet>

      <MatchPrivateMemoSheet
        open={memoOpen}
        onClose={() => setMemoOpen(false)}
        myUid={user.uid}
        peerUid={peerUid}
        peerDisplayName={displayName}
      />
    </>
  );
}
