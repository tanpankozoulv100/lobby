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

function ConnectionsConfigMissing() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">連携</h2>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        .env.local の Firebase 設定を確認してください。
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
  const [peerInput, setPeerInput] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubCode: (() => void) | null = null;
    let unsubLinks: (() => void) | null = null;
    let unsubInbound: (() => void) | null = null;

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

    return () => {
      cancelled = true;
      unsubCode?.();
      unsubLinks?.();
      unsubInbound?.();
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

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">連携</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        6文字コードで連携すると、あなたの一覧に加え、相手側には「あなたから連携された」記録も付きます。お互いに連携すると「相互」と表示されます。
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
            <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {links.map((row) => {
                const mutual =
                  inbound?.some((i) => i.sourceUid === row.peerUid) ?? false;
                return (
                  <li key={row.peerUid} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span>{shortUid(row.peerUid)}</span>
                    {mutual ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        相互
                      </span>
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
            <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {inbound.map((row) => (
                <li key={row.sourceUid}>{shortUid(row.sourceUid)}</li>
              ))}
            </ul>
          ) : inbound && inbound.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">まだいません</p>
          ) : null}
        </div>
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
