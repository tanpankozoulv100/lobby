"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  ensureMyConnectionCode,
  registerLinkByPeerCode,
  subscribeInboundLinks,
  subscribeMyConnectionCode,
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

function ConnectionsConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">連携</h2>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        接続できませんでした。しばらく経ってからお試しください。
      </p>
    </section>
  );
}

function shortUid(uid: string) {
  return uid.length <= 12 ? uid : `${uid.slice(0, 8)}…`;
}

function DashboardConnectionsLoaded({ user }: { user: User }) {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [links, setLinks] = useState<OutboundLinkRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [inbound, setInbound] = useState<InboundLinkRow[] | null>(null);
  const [inboundError, setInboundError] = useState<string | null>(null);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [peerInput, setPeerInput] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [reportForUid, setReportForUid] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<UserReportReasonCode>("other");
  const [reportNote, setReportNote] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [blockBusyUid, setBlockBusyUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubCode: (() => void) | null = null;
    let unsubLinks: (() => void) | null = null;
    let unsubInbound: (() => void) | null = null;
    let unsubBlocked: (() => void) | null = null;

    void (async () => {
      await ensureMyConnectionCode(user.uid);
      if (cancelled) return;
      unsubCode = subscribeMyConnectionCode(
        user.uid,
        (code) => {
          setMyCode(code);
          setCodeLoading(false);
          setCodeError(null);
        },
        (msg) => {
          setCodeError(msg);
          setCodeLoading(false);
        }
      );
    })();

    unsubLinks = subscribeOutboundLinks(
      user.uid,
      (rows) => {
        setLinks(rows);
        setLinksError(null);
      },
      (msg) => setLinksError(msg)
    );

    unsubInbound = subscribeInboundLinks(
      user.uid,
      (rows) => {
        setInbound(rows);
        setInboundError(null);
      },
      (msg) => setInboundError(msg)
    );

    unsubBlocked = subscribeBlockedPeerUids(user.uid, setBlockedUids);

    return () => {
      cancelled = true;
      unsubCode?.();
      unsubLinks?.();
      unsubInbound?.();
      unsubBlocked?.();
    };
  }, [user.uid]);

  const handleLink = useCallback(async () => {
    setLinkMessage(null);
    setLinkPending(true);
    const result = await registerLinkByPeerCode(user.uid, peerInput);
    setLinkPending(false);
    if (result.ok) {
      setLinkMessage("連携を登録しました。");
      setPeerInput("");
    } else {
      setLinkMessage(result.message);
    }
  }, [user.uid, peerInput]);

  const handleToggleBlock = useCallback(
    async (peerUid: string) => {
      setLinkMessage(null);
      setBlockBusyUid(peerUid);
      const isBlocked = blockedUids.includes(peerUid);
      const result = isBlocked ? await unblockPeer(user.uid, peerUid) : await blockPeer(user.uid, peerUid);
      setBlockBusyUid(null);
      if (result.ok) {
        setLinkMessage(isBlocked ? "ブロックを解除しました。" : "ブロックしました。");
        if (reportForUid === peerUid) setReportForUid(null);
      } else {
        setLinkMessage(result.message);
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
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">連携</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        6文字コードで連携すると、あなたの一覧に加え、相手側には「あなたから連携された」記録も付きます。お互いに連携すると「相互」と表示されます。問題がある場合は
        <span className="font-medium text-zinc-800 dark:text-zinc-200">通報・ブロック</span>
        からご連絡ください。
      </p>
      {codeError ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {codeError}
        </p>
      ) : null}
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">あなたの連携コード</p>
          {codeLoading ? (
            <p className="mt-1 text-sm text-zinc-500">発行中…</p>
          ) : myCode ? (
            <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-zinc-900 dark:text-zinc-50">
              {myCode}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">まだコードがありません。再読み込みしてください。</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">相手にこのコードを伝えてください。</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
          <label htmlFor="peer-code" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            相手の連携コード
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="peer-code"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={8}
              value={peerInput}
              onChange={(e) => setPeerInput(e.target.value.toUpperCase())}
              placeholder="例: A1B2C3"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 outline-none ring-rose-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              disabled={linkPending}
              onClick={() => void handleLink()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {linkPending ? "登録中…" : "連携する"}
            </button>
          </div>
          {linkMessage ? (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{linkMessage}</p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            あなたが連携した人数: {links === null ? "…" : links.length}
          </p>
          {linksError ? (
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{linksError}</p>
          ) : null}
          {links && links.length > 0 ? (
            <ul className="mt-2 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              {links.map((row) => {
                const mutual =
                  inbound?.some((i) => i.sourceUid === row.peerUid) ?? false;
                const isBlocked = blockedUids.includes(row.peerUid);
                const reporting = reportForUid === row.peerUid;
                return (
                  <li
                    key={row.peerUid}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-900/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="text-zinc-800 dark:text-zinc-200">{shortUid(row.peerUid)}</span>
                      {mutual ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          相互
                        </span>
                      ) : null}
                      {isBlocked ? (
                        <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          ブロック中
                        </span>
                      ) : null}
                      <span className="ml-auto flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={blockBusyUid === row.peerUid}
                          onClick={() => void handleToggleBlock(row.peerUid)}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-900 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/70"
                        >
                          {reporting ? "通報を閉じる" : "通報"}
                        </button>
                      </span>
                    </div>
                    {reporting ? (
                      <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-600">
                        <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">理由</label>
                        <select
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value as UserReportReasonCode)}
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                        >
                          {USER_REPORT_REASON_CODES.map((code) => (
                            <option key={code} value={code}>
                              {REPORT_REASON_LABEL[code]}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          補足（任意・500文字以内）
                        </label>
                        <textarea
                          value={reportNote}
                          onChange={(e) => setReportNote(e.target.value)}
                          maxLength={500}
                          rows={2}
                          className="w-full resize-y rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                        />
                        <button
                          type="button"
                          disabled={reportPending}
                          onClick={() => void handleSubmitReport()}
                          className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {reportPending ? "送信中…" : "通報を送信"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-600">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            あなたのコードで連携してくれた人: {inbound === null ? "…" : inbound.length}
          </p>
          {inboundError ? (
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{inboundError}</p>
          ) : null}
          {inbound && inbound.length > 0 ? (
            <ul className="mt-2 space-y-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {inbound.map((row) => {
                const isBlocked = blockedUids.includes(row.sourceUid);
                const reporting = reportForUid === row.sourceUid;
                return (
                  <li
                    key={row.sourceUid}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-900/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-zinc-800 dark:text-zinc-200">{shortUid(row.sourceUid)}</span>
                      {isBlocked ? (
                        <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          ブロック中
                        </span>
                      ) : null}
                      <span className="ml-auto flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={blockBusyUid === row.sourceUid}
                          onClick={() => void handleToggleBlock(row.sourceUid)}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                        >
                          {blockBusyUid === row.sourceUid
                            ? "…"
                            : isBlocked
                              ? "ブロック解除"
                              : "ブロック"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReportMessage(null);
                            setReportForUid((prev) => (prev === row.sourceUid ? null : row.sourceUid));
                          }}
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-900 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/70"
                        >
                          {reporting ? "通報を閉じる" : "通報"}
                        </button>
                      </span>
                    </div>
                    {reporting ? (
                      <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-600">
                        <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">理由</label>
                        <select
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value as UserReportReasonCode)}
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                        >
                          {USER_REPORT_REASON_CODES.map((code) => (
                            <option key={code} value={code}>
                              {REPORT_REASON_LABEL[code]}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          補足（任意・500文字以内）
                        </label>
                        <textarea
                          value={reportNote}
                          onChange={(e) => setReportNote(e.target.value)}
                          maxLength={500}
                          rows={2}
                          className="w-full resize-y rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                        />
                        <button
                          type="button"
                          disabled={reportPending}
                          onClick={() => void handleSubmitReport()}
                          className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {reportPending ? "送信中…" : "通報を送信"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : inbound && inbound.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">まだいません</p>
          ) : null}
        </div>
        {reportMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
            {reportMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardConnectionsSection({ user }: { user: User }) {
  if (!isFirebaseConfigComplete()) {
    return <ConnectionsConfigMissing />;
  }
  return <DashboardConnectionsLoaded user={user} />;
}
