"use client";

import { useCallback, useId, useRef } from "react";
import {
  CONNECTION_CODE_LENGTH,
  normalizeConnectionCodeInput,
  parseConnectionCodePaste,
} from "@/lib/connection-code-input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
};

/**
 * 非制御 input（uncontrolled）にして、入力中に React が DOM の値を上書きしないようにする。
 * iOS / 予測変換キーボードでは「制御された value を打鍵中に書き戻す」と composition が中断され
 * 文字が消える（打っても何も出ない）。そのため表示はブラウザ任せにし、
 * 親へ渡す値だけを正規化（大文字・英数字6文字）する。見た目の大文字化は CSS で行う。
 */
export function LobbyConnectionCodeInput({ value, onChange, onComplete, disabled }: Props) {
  const inputId = useId();
  const composingRef = useRef(false);

  const propagate = useCallback(
    (raw: string, fireComplete: boolean) => {
      const next = normalizeConnectionCodeInput(raw);
      onChange(next);
      if (fireComplete && next.length === CONNECTION_CODE_LENGTH) {
        onComplete?.(next);
      }
    },
    [onChange, onComplete]
  );

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
        defaultValue={value}
        maxLength={12}
        placeholder="ABC123"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center font-mono text-2xl font-semibold uppercase tracking-[0.35em] text-zinc-900 caret-[var(--lobby-red)] outline-none placeholder:tracking-normal placeholder:text-zinc-300 placeholder:normal-case focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25 disabled:opacity-50"
        onChange={(e) => propagate(e.target.value, !composingRef.current)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          propagate(e.currentTarget.value, true);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const parsed = parseConnectionCodePaste(e.clipboardData.getData("text"));
          if (parsed) {
            e.currentTarget.value = parsed;
            propagate(parsed, true);
          }
        }}
      />
      <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500">
        日本語入力はオフのまま、英数字を直接入力してください。貼り付け（LOBBY:ABC123）も使えます。
      </p>
    </div>
  );
}
