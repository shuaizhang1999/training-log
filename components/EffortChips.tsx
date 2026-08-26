"use client";

import type { Effort } from "@/lib/types";

interface EffortChipsProps {
  value: Effort | null;
  onChange(effort: Effort): void;
}

const OPTIONS: { value: Effort; label: string; onClasses: string }[] = [
  { value: "easy", label: "Easy", onClasses: "border-easy bg-easy text-black" },
  { value: "ok", label: "OK", onClasses: "border-okay bg-okay text-black" },
  { value: "hard", label: "Hard", onClasses: "border-hard bg-hard text-black" },
];

/** Required before saving — goes into the "Reps in reserve" column as a word. */
export function EffortChips({ value, onChange }: EffortChipsProps) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Effort">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`h-[52px] rounded-xl border font-display text-sm font-semibold uppercase tracking-[0.18em] transition-all active:scale-95 ${
              selected ? opt.onClasses : "border-line bg-surface2 text-dim"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
