"use client";

import { useCallback, useEffect, useState } from "react";
import { LobbyBottomSheet } from "@/components/lobby-bottom-sheet";
import { saveMatchMemo, subscribeMatchMemo } from "@/lib/firestore-match-memos";

export function MatchPrivateMemoSheet({
  open,
  onClose,
  myUid,
  peerUid,
  peerDisplayName,
}: {
  open: boolean;
  onClose: () => void;
  myUid: string;
  peerUid: string;
  peerDisplayName: string;
}) {
  const [nickname, setNickname] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeMatchMemo(myUid, peerUid, (data) => {
      setNickname(data?.nickname ?? "");
      setMemo(data?.memo ?? "");
    });
    return () => unsub?.();
  }, [open, myUid, peerUid]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    const res = await saveMatchMemo(myUid, peerUid, nickname, memo);
    setSaving(false);
    if (res.ok) {
      setMessage("保存しました。");
    } else {
      setMessage(res.message);
    }
  }, [myUid, peerUid, nickname, memo]);

  return (
    <LobbyBottomSheet open={open} title="自由メモ（自分だけに表示）" onClose={onClose}>
      <div className="space-y-4 pb-4">
        <p className="text-xs text-zinc-500">
          {peerDisplayName} さんについて、自分用のメモです。相手には表示されません。
        </p>
        {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p> : null}
        <div>
          <label htmlFor="memo-nickname" className="mb-1 block text-xs font-medium text-zinc-600">
            ニックネーム
          </label>
          <input
            id="memo-nickname"
            type="text"
            maxLength={50}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例: 会場で話した人"
            className="w-full rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="memo-body" className="mb-1 block text-xs font-medium text-zinc-600">
            自由メモ欄
          </label>
          <textarea
            id="memo-body"
            rows={5}
            maxLength={2000}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded-full border-2 border-[var(--lobby-red)] bg-white py-3 text-sm font-medium text-[var(--lobby-red)] disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </LobbyBottomSheet>
  );
}
