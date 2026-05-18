"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  subscribeInboundLinks,
  subscribeOutboundLinks,
  type InboundLinkRow,
  type OutboundLinkRow,
} from "@/lib/firestore-connections";
import type { UserReportReasonCode } from "@/lib/lobby-firestore-types";
import {
  blockPeer,
  submitUserReport,
  subscribeBlockedPeerUids,
  unblockPeer,
  USER_REPORT_REASON_CODES,
} from "@/lib/firestore-safety";

const REPORT_REASON_LABEL: Record<UserReportReasonCode, string> = {
  harassment: "嫌がらせ・脅迫",
  spam: "スパム・広告",
  inappropriate: "不適切な内容",
  other: "その他",
};

function HistoryConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-zinc-900">マッチング履歴</h2>
      <p className="mt-3 text-sm text-zinc-600">接続できませんでした。しばらく経ってからお試しください。</p>
    </section>
  );
}

function DashboardConnectionsLoaded({ user }: { user: User }) {
  const [links, setLinks] = useState<OutboundLinkRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [inbound, setInbound] = useState<InboundLinkRow[] | null>(null);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [reportForUid, setReportForUid] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<UserReportReasonCode>("other");
  const [reportNote, setReportNote] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [blockBusyUid, setBlockBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubLinks = subscribeOutboundLinks(
      user.uid,
      (rows) => {
        setLinks(rows);
        setLinksError(null);
      },
      (msg) => setLinksError(msg)
    );

    const unsubInbound = subscribeInboundLinks(
      user.uid,
      (rows) => setInbound(rows),
      () => setInbound(null)
    );

    const unsubBlocked = subscribeBlockedPeerUids(user.uid, setBlockedUids);

    return () => {
      unsubLinks?.();
      unsubInbound?.();
      unsubBlocked?.();
    };
  }, [user.uid]);

  const handleToggleBlock = useCallback(
    async (peerUid: string) => {
      setStatusMessage(null);
      setBlockBusyUid(peerUid);
      const isBlocked = blockedUids.includes(peerUid);
      const result = isBlocked ? await unblockPeer(user.uid, peerUid) : await blockPeer(user.uid, peerUid);
      setBlockBusyUid(null);
      if (result.ok) {
        setStatusMessage(isBlocked ? "ブロックを解除しました。" : "ブロックしました。");
        if (reportForUid === peerUid) setReportForUid(null);
      } else {
        setStatusMessage(result.message);
      }
    },
    [user.uid, blockedUids, reportForUid]
  );

  const handleSubmitReport = useCallback(async () => {
    if (!reportForUid) return;
    setReportMessage(null);
    setReportPending(true);
    const result = await submitUserReport({
      reporterUid: user.uid,
      reportedUid: reportForUid,
      reasonCode: reportReason,
      note: reportNote,
    });
    setReportPending(false);
    if (result.ok) {
      setReportMessage("通報を受け付けました。運営が内容を確認します。");
      setReportForUid(null);
      setReportNote("");
      setReportReason("other");
    } else {
      setReportMessage(result.message);
    }
  }, [user.uid, reportForUid, reportReason, reportNote]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-zinc-900">マッチング履歴</h2>
      <p className="mt-1 text-sm text-zinc-600">
        ホームの「スキャン」または「表示する」のQRでマッチした相手の一覧です。問題がある場合は通報・ブロックできます。
      </p>

      {statusMessage ? (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{statusMessage}</p>
      ) : null}
      {reportMessage ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {reportMessage}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-sm font-medium text-zinc-800">
          マッチ数: {links === null ? "…" : links.length}
        </p>
        {linksError ? <p className="mt-1 text-sm text-amber-800">{linksError}</p> : null}

        {links === null ? (
          <p className="mt-3 text-sm text-zinc-500">読み込み中…</p>
        ) : links.length === 0 ? (
          <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
            まだマッチがありません。ホームから相手のQRをスキャンするか、相手にあなたのQRを読み取ってもらってください。
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {links.map((row) => {
              const mutual = inbound?.some((i) => i.sourceUid === row.peerUid) ?? false;
              const isBlocked = blockedUids.includes(row.peerUid);
              const reporting = reportForUid === row.peerUid;
              return (
                <li
                  key={row.peerUid}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">
                      {mutual ? "相互マッチ" : "マッチ"}
                    </span>
                    {isBlocked ? (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                        ブロック中
                      </span>
                    ) : null}
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={blockBusyUid === row.peerUid}
                        onClick={() => void handleToggleBlock(row.peerUid)}
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 disabled:opacity-50"
                      >
                        {blockBusyUid === row.peerUid
                          ? "…"
                          : isBlocked
                            ? "ブロック解除"
                            : "ブロック"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportMessage(null);
                          setReportForUid((prev) => (prev === row.peerUid ? null : row.peerUid));
                        }}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-900"
                      >
                        {reporting ? "閉じる" : "通報"}
                      </button>
                    </span>
                  </div>
                  {reporting ? (
                    <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
                      <label className="block text-xs font-medium text-zinc-500">理由</label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value as UserReportReasonCode)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                      >
                        {USER_REPORT_REASON_CODES.map((code) => (
                          <option key={code} value={code}>
                            {REPORT_REASON_LABEL[code]}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={reportNote}
                        onChange={(e) => setReportNote(e.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="補足（任意）"
                        className="w-full resize-y rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={reportPending}
                        onClick={() => void handleSubmitReport()}
                        className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {reportPending ? "送信中…" : "通報を送信"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function DashboardConnectionsSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <HistoryConfigMissing />;
  }
  return <DashboardConnectionsLoaded user={user} />;
}
