"use client";

import { useEffect, useRef, useState } from "react";

interface StepperProps {
  label: string;
  value: number;
  /** Amount added/removed per tap (kg increment from config, or 1 for reps). */
  step: number;
  min?: number;
  max?: number;
  /** 1 for kg (34.3), 0 for reps. */
  decimals: 0 | 1;
  onChange(next: number): void;
}

/**
 * Big-thumb stepper: tap to step, hold to auto-repeat, long-press the value to
 * type on a numeric keyboard (the fallback, never the default path).
 */
export function Stepper({ label, value, step, min = 0, max = 999, decimals, onChange }: StepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const valueRef = useRef(value);
  valueRef.current = value;

  const repeatTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerActive = useRef(false);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const round = (v: number) => (decimals === 1 ? Math.round(v * 10) / 10 : Math.round(v));
  const clamp = (v: number) => Math.min(max, Math.max(min, round(v)));

  const applyDelta = (direction: 1 | -1) => {
    // Track the new value in the ref immediately: rapid taps and hold-repeat
    // ticks can land in one React batch, where reading only the rendered prop
    // would compute every step from the same stale value.
    const next = clamp(valueRef.current + direction * step);
    valueRef.current = next;
    onChange(next);
  };

  const stopRepeat = () => {
    if (repeatTimeout.current) clearTimeout(repeatTimeout.current);
    if (repeatInterval.current) clearInterval(repeatInterval.current);
    repeatTimeout.current = null;
    repeatInterval.current = null;
    setTimeout(() => (pointerActive.current = false), 80);
  };

  const startRepeat = (direction: 1 | -1) => {
    pointerActive.current = true;
    applyDelta(direction);
    repeatTimeout.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => applyDelta(direction), 110);
    }, 450);
  };

  useEffect(() => stopRepeat, []);

  const commitDraft = () => {
    setEditing(false);
    const parsed = parseFloat(draft.replace(",", "."));
    if (isFinite(parsed)) onChange(clamp(parsed));
  };

  const startLongPress = () => {
    longPressTimeout.current = setTimeout(() => {
      setDraft(String(value));
      setEditing(true);
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    longPressTimeout.current = null;
  };

  const display = decimals === 1 ? String(Math.round(value * 10) / 10) : String(value);

  const sideButton =
    "w-12 shrink-0 text-2xl font-medium text-dim transition-colors active:bg-surface active:text-ink disabled:opacity-30";

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dim">
        {label}
      </div>
      <div className="flex h-[52px] items-stretch overflow-hidden rounded-xl border border-line bg-surface2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onPointerDown={() => startRepeat(-1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (!pointerActive.current) applyDelta(-1);
          }}
          className={sideButton}
        >
          −
        </button>

        {editing ? (
          <input
            autoFocus
            inputMode={decimals === 1 ? "decimal" : "numeric"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitDraft}
            onKeyDown={(e) => e.key === "Enter" && commitDraft()}
            className="min-w-0 flex-1 border-x border-line bg-surface text-center font-mono text-xl font-semibold tabular-nums text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            aria-label={`${label}: ${display}. Hold to type`}
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onContextMenu={(e) => e.preventDefault()}
            className="min-w-0 flex-1 border-x border-line font-mono text-xl font-semibold tabular-nums"
          >
            {display}
          </button>
        )}

        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onPointerDown={() => startRepeat(1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (!pointerActive.current) applyDelta(1);
          }}
          className={sideButton}
        >
          +
        </button>
      </div>
    </div>
  );
}
