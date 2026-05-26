"use client";

import { useId, useState } from "react";

export type LobbyOptionPickerOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  label: string;
  value: string;
  options: LobbyOptionPickerOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  /** 都道府県など選択肢が多いとき */
  listMaxHeightClassName?: string;
};

export function LobbyOptionPicker({
  id: idProp,
  label,
  value,
  options,
  placeholder = "未選択",
  onChange,
  listMaxHeightClassName = "max-h-48",
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;
  const hasValue = value.length > 0;

  return (
    <div>
      <span id={`${id}-label`} className="mb-1 block text-xs font-medium text-zinc-700">
        {label}
      </span>
      <button
        type="button"
        id={id}
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-[var(--lobby-surface-raised)] px-3 py-2.5 text-left text-base text-zinc-900"
      >
        <span className={hasValue ? "line-clamp-2" : "text-zinc-400"}>{selectedLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className={`mt-2 space-y-1 overflow-y-auto overscroll-y-contain rounded-xl border border-zinc-200 bg-white p-1 shadow-sm touch-pan-y ${listMaxHeightClassName}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {options.map((opt) => {
            const selected = value === opt.value;
            return (
              <li key={opt.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm leading-snug transition ${
                    selected
                      ? "bg-[var(--lobby-red)]/10 font-medium text-[var(--lobby-red)]"
                      : "text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
