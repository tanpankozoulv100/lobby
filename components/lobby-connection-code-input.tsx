"use client";

import { useCallback, useId, useRef } from "react";
import {
  CONNECTION_CODE_LENGTH,
  normalizeConnectionCodeInput,
  parseConnectionCodePaste,
} from "@/lib/connection-code-input";
import { formatConnectionCodeDisplay } from "@/lib/connection-code-display";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
};

/**
 * 1つの input にまとめる（6マス分割は iOS 日本語変換で文字が重複しやすい）。
 */
export function LobbyConnectionCodeInput({ value, onChange, onComplete, disabled }: Props) {
  const inputId = useId();
  const composingRef = useRef(false);

  const applyValue = useCallback(
    (raw: string) => {
      const next = normalizeConnectionCodeInput(raw);
      onChange(next);
      if (next.length === CONNECTION_CODE_LENGTH) {
        onComplete?.(next);
      }
    },
    [onChange, onComplete]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) return;
      applyValue(e.target.value);
    },
    [applyValue]
  );

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      applyValue(e.currentTarget.value);
    },
    [applyValue]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const parsed = parseConnectionCodePaste(e.clipboardData.getData("text"));
      if (parsed) applyValue(parsed);
    },
    [applyValue]
  );

  const display =
    value.length === CONNECTION_CODE_LENGTH ? formatConnectionCodeDisplay(value) : value;

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-center text-xs font-medium text-zinc-600">
        マッチングコード（英数字6文字）
      </label>
      <input
        id={inputId}
        type="text"
        lang="en"
        inputMode="text"
        enterKeyHint="done"
        name="lobby-connection-code"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore
        disabled={disabled}
        value={display}
        maxLength={7}
        placeholder="ABC123"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center font-mono text-2xl font-semibold tracking-[0.35em] text-zinc-900 outline-none placeholder:tracking-normal placeholder:text-zinc-300 focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25 disabled:opacity-50"
        onChange={handleChange}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
      />
      <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500">
        日本語入力はオフのまま、英数字を直接入力してください。貼り付け（LOBBY:ABC123）も使えます。
      </p>
    </div>
  );
}
