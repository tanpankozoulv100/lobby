"use client";

import { useCallback, useEffect, useState } from "react";
import { CONNECTION_CODE_LENGTH } from "@/lib/connection-code-input";
import { LobbyConnectionCodeInput } from "@/components/lobby-connection-code-input";
import { registerLinkByPeerCode } from "@/lib/firestore-connections";
import { withTimeout } from "@/lib/promise-timeout";

type Props = {
  open: boolean;
  onClose: () => void;
  uid: string;
  onBackToCamera?: () => void;
  onMatched?: (result: { rematched: boolean }) => void;
  /** 運営スタッフは再マッチの24時間制限をスキップ（動作確認用） */
  bypassCooldown?: boolean;
};

export function LobbyCodeInputModal({
  open,
  onClose,
  uid,
  onBackToCamera,
  onMatched,
  bypassCooldown,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setMessage(null);
      setSuccess(null);
      setBusy(false);
    }
  }, [open]);

  const submit = useCallback(
    async (raw: string) => {
      if (busy || raw.length !== CONNECTION_CODE_LENGTH) return;
      setMessage(null);
      setSuccess(null);
      setBusy(true);
      let result: Awaited<ReturnType<typeof registerLinkByPeerCode>>;
      try {
        result = await withTimeout(registerLinkByPeerCode(uid, raw, { bypassCooldown }), 15000, {
          ok: false,
          message: "通信に時間がかかっています。電波状況を確認して、もう一度お試しください。",
        });
      } catch {
        result = { ok: false, message: "マッチングに失敗しました。通信環境を確認して、もう一度お試しください。" };
      } finally {
        setBusy(false);
      }
      if (result.ok) {
        const text = result.rematched
          ? "再マッチしました。チャットの送信期限が更新されます。"
          : "マッチングしました。";
        setSuccess(text);
        onMatched?.({ rematched: result.rematched === true });
        window.setTimeout(() => {
          setCode("");
          setSuccess(null);
          onClose();
        }, 900);
        return;
      }
      setMessage(result.message);
    },
    [uid, busy, onClose, onMatched, bypassCooldown]
  );

  const handleSubmit = useCallback(() => {
    void submit(code);
  }, [submit, code]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-black/45 px-4 py-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="連携コード入力"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-6 shadow-xl">
        <h2 className="text-center font-serif text-lg font-semibold text-zinc-900">コードでマッチング</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-zinc-600">
          相手のマッチングコード（6文字）を入力するか、QRをスキャンしてください。
          <span className="mt-1 block text-xs text-zinc-500">
            再マッチは、前回マッチから24時間（最終日は72時間）経過後に可能です。
          </span>
        </p>
        {message ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p>
        ) : null}
        <div className="mt-5">
          <LobbyConnectionCodeInput
            value={code}
            disabled={busy || !!success}
            onChange={setCode}
            onComplete={(filled) => void submit(filled)}
          />
        </div>
        {onBackToCamera ? (
          <button
            type="button"
            onClick={() => {
              setCode("");
              setMessage(null);
              setSuccess(null);
              onBackToCamera();
            }}
            className="mt-4 w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700"
          >
            カメラでスキャンする
          </button>
        ) : null}
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setCode("");
              setMessage(null);
              setSuccess(null);
              onClose();
            }}
            className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-700"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy || code.length !== CONNECTION_CODE_LENGTH || !!success}
            onClick={handleSubmit}
            className="flex-1 rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            {busy ? "処理中…" : "マッチング"}
          </button>
        </div>
      </div>
    </div>
  );
}
