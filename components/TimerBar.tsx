"use client";

import { useEffect, useRef, useState } from "react";
import { useTimer } from "@/app/providers";
import { playTimerDone, vibrate } from "@/lib/beep";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The rest timer readout. Pinned above everything (z-50, above the logging
 * card) so it stays visible across navigation. Counts down from the exercise's
 * configured rest, drains an orange progress track, and fires vibration +
 * three beeps at zero, then clears itself after a few seconds.
 */
export function TimerBar() {
  const { active, extend, dismiss } = useTimer();
  const [now, setNow] = useState(() => Date.now());
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);

  // Fire the done signal exactly once per countdown (keyed by endsAt).
  const remaining = active ? active.endsAt - now : 0;
  useEffect(() => {
    if (!active) {
      firedForRef.current = null;
      return;
    }
    if (remaining <= 0 && firedForRef.current !== active.endsAt) {
      firedForRef.current = active.endsAt;
      vibrate([250, 120, 250]);
      playTimerDone();
      const id = setTimeout(dismiss, 8000);
      return () => clearTimeout(id);
    }
  }, [active, remaining, dismiss]);

  if (!active) return null;

  const done = remaining <= 0;
  const fraction = Math.min(1, Math.max(0, remaining / (active.totalSec * 1000)));

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface/95 pt-safe backdrop-blur">
      <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
            {done ? "Rest over" : "Resting"}
          </div>
          <div className="truncate font-display text-base font-semibold uppercase tracking-wide">
            {active.exercise}
          </div>
        </div>

        <div
          className={`font-mono text-3xl font-semibold tabular-nums ${
            done ? "animate-done text-accent" : ""
          }`}
        >
          {done ? "GO" : formatClock(remaining)}
        </div>

        {!done && (
          <button
            onClick={() => extend(30)}
            className="h-11 shrink-0 rounded-lg border border-line bg-surface2 px-3 font-mono text-sm font-semibold text-ink active:scale-95"
          >
            +30s
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss timer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface2 text-dim active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Draining progress track */}
      <div className="relative h-1.5 w-full overflow-hidden bg-surface2">
        {done ? (
          <div className="hazard h-full w-full opacity-90" />
        ) : (
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${fraction * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** Height of the fixed bar, for screens that need to pad below it. */
export function useTimerBarActive(): boolean {
  return useTimer().active !== null;
}
