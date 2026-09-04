"use client";

import { Stepper } from "./Stepper";
import type { Side } from "@/lib/types";

interface SetRowProps {
  /** Per-side set number, 1-based ("L2" = left side's second set). */
  index: number;
  side?: Side;
  bodyweight: boolean;
  kg: number;
  reps: number;
  done: boolean;
  onChange(patch: { kg?: number; reps?: number }): void;
  onToggle(): void;
}

/** One set in the stack: label + ✓ on top, steppers below. */
export function SetRow({
  index,
  side,
  bodyweight,
  kg,
  reps,
  done,
  onChange,
  onToggle,
}: SetRowProps) {
  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        done ? "border-accent/70 bg-accent/[0.06]" : "border-line bg-surface"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2 font-display font-semibold uppercase tracking-[0.14em]">
          {side && (
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-sm ${
                side === "L"
                  ? "border-accent/50 text-accent"
                  : "border-easy/50 text-easy"
              }`}
            >
              {side}
            </span>
          )}
          <span className="text-sm text-dim">Set {index}</span>
          {bodyweight && <span className="text-xs text-dim/70">BW</span>}
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label={`${done ? "Uncheck" : "Complete"} ${
            side === "L" ? "left " : side === "R" ? "right " : ""
          }set ${index}`}
          aria-pressed={done}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all active:scale-90 ${
            done
              ? "border-accent bg-accent text-black"
              : "border-line bg-surface2 text-dim"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M4 10.5l4 4 8-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex gap-2">
        {!bodyweight && (
          <Stepper
            label="kg"
            value={kg}
            step={1}
            decimals={1}
            onChange={(v) => onChange({ kg: v })}
          />
        )}
        <Stepper
          label="reps"
          value={reps}
          step={1}
          decimals={0}
          onChange={(v) => onChange({ reps: v })}
        />
      </div>
    </div>
  );
}
