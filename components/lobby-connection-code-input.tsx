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

export function LobbyConnectionCodeInput({ value, onChange, onComplete, disabled }: Props) {
  const labelId = useId();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length: CONNECTION_CODE_LENGTH }, (_, i) => value[i] ?? "");

  const applyValue = useCallback(
    (nextRaw: string) => {
      const next = normalizeConnectionCodeInput(nextRaw);
      onChange(next);
      if (next.length === CONNECTION_CODE_LENGTH) {
        onComplete?.(next);
      }
      return next;
    },
    [onChange, onComplete]
  );

  const focusIndex = useCallback((index: number) => {
    const el = refs.current[Math.max(0, Math.min(index, CONNECTION_CODE_LENGTH - 1))];
    el?.focus();
    el?.select();
  }, []);

  const setAt = useCallback(
    (index: number, raw: string) => {
      const normalized = normalizeConnectionCodeInput(raw);
      const slots = Array.from({ length: CONNECTION_CODE_LENGTH }, (_, i) => value[i] ?? "");

      if (normalized.length > 1) {
        applyValue(normalized);
        focusIndex(Math.min(normalized.length, CONNECTION_CODE_LENGTH - 1));
        return;
      }

      if (!normalized) {
        slots[index] = "";
        const next = applyValue(slots.join("").replace(/\s/g, ""));
        focusIndex(Math.min(index, next.length));
        return;
      }

      slots[index] = normalized[0]!;
      const next = applyValue(slots.join(""));
      if (next.length < CONNECTION_CODE_LENGTH && index < CONNECTION_CODE_LENGTH - 1) {
        focusIndex(index + 1);
      }
    },
    [value, applyValue, focusIndex]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (chars[index]) {
          const arr = value.split("");
          arr[index] = "";
          applyValue(arr.join(""));
          focusIndex(index);
        } else if (index > 0) {
          const arr = value.split("");
          arr[index - 1] = "";
          applyValue(arr.join(""));
          focusIndex(index - 1);
        }
        return;
      }
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        focusIndex(index - 1);
      }
      if (e.key === "ArrowRight" && index < CONNECTION_CODE_LENGTH - 1) {
        e.preventDefault();
        focusIndex(index + 1);
      }
    },
    [chars, value, applyValue, focusIndex]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const parsed = parseConnectionCodePaste(e.clipboardData.getData("text"));
      if (!parsed) return;
      applyValue(parsed);
      focusIndex(Math.min(parsed.length, CONNECTION_CODE_LENGTH - 1));
    },
    [applyValue, focusIndex]
  );

  return (
    <div>
      <p id={labelId} className="sr-only">
        マッチングコード6文字
      </p>
      <div
        className="flex justify-center gap-2"
        role="group"
        aria-labelledby={labelId}
        onPaste={handlePaste}
      >
        {chars.map((ch, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="text"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={6}
            disabled={disabled}
            value={ch}
            aria-label={`${index + 1}文字目`}
            className="h-14 w-11 rounded-xl border border-zinc-200 bg-zinc-50 text-center font-mono text-xl font-semibold uppercase text-zinc-900 outline-none focus:border-[var(--lobby-red)] focus:ring-2 focus:ring-[var(--lobby-red)]/25 disabled:opacity-50 sm:h-16 sm:w-12 sm:text-2xl"
            onKeyDown={(e) => handleKeyDown(index, e)}
            onChange={(e) => setAt(index, e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">
        例: A B C 1 2 3（貼り付け・LOBBY:ABC123 も可）
      </p>
    </div>
  );
}
