"use client";

import { useCallback, useState } from "react";
import { registerLinkByPeerCode } from "@/lib/firestore-connections";

type Props = {
  open: boolean;
  onClose: () => void;
  uid: string;
  onMatched?: () => void;
};

export function LobbyScanModal({ open, onClose, uid, onMatched }: Props) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    const result = await registerLinkByPeerCode(uid, raw);
    setBusy(false);
    if (result.ok) {
      setRaw("");
      onMatched?.();
      onClose();
      return;
    }
    setMessage(result.message);
  }, [uid, raw, onClose, onMatched]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/45 px-4 pt-[env(safe-area-inset-top)] pb-8"
      role="dialog"
      aria-modal="true"
      aria-label="スキャン（連携コード入力）"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-6 shadow-xl">
        <h2 className="text-center font-serif text-lg font-semibold text-zinc-900">マッチング</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-zinc-600">
          相手の QR を読み取った内容、または 6 文字の連携コードを貼り付けてください。
        </p>
        {message ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
        ) : null}
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          placeholder="例: LOBBY:ABC123 または ABC123"
          className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setRaw("");
              setMessage(null);
              onClose();
            }}
            className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-700"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy || !raw.trim()}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl bg-[var(--lobby-red)] py-3 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            {busy ? "処理中…" : "マッチングする"}
          </button>
        </div>
      </div>
    </div>
  );
}
