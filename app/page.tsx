"use client";

import { useState } from "react";
import { useData, useTimer } from "./providers";
import { LoggingCard } from "@/components/LoggingCard";
import { SyncBadge } from "@/components/SyncBadge";
import { EXERCISES, isBodyweight, type ExerciseConfig } from "@/lib/exercises";
import { formatKg, localDateString, relativeDateLabel, topSetValue } from "@/lib/rowcodec";

/** Session screen: the exercise grid. Tap a tile, log, done. */
export default function SessionPage() {
  const { latestFor, savedToday, hasPending, loading, stale } = useData();
  const timerActive = useTimer().active !== null;
  const [open, setOpen] = useState<ExerciseConfig | null>(null);

  const today = new Date();
  const dateLabel = today
    .toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();

  return (
    <main
      className="mx-auto max-w-md px-4 pb-28 pt-safe"
      style={timerActive ? { paddingTop: "calc(env(safe-area-inset-top) + 70px)" } : undefined}
    >
      <header className="flex items-end justify-between pb-3 pt-4">
        <div>
          <div className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
            Training Log
          </div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">
            {dateLabel}
          </h1>
        </div>
        <SyncBadge />
      </header>

      <div className="hazard mb-4 h-[3px] rounded-full opacity-80" />

      {stale && (
        <p className="mb-3 rounded-lg border border-okay/30 bg-okay/10 px-3 py-2 font-mono text-xs text-okay">
          Can&apos;t reach the sheet — showing last saved data
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {EXERCISES.map((cfg) => {
          const latest = latestFor(cfg.name);
          const bw = isBodyweight(cfg);
          const done = savedToday(cfg.name);
          const pending = hasPending(cfg.name);

          let subline = "no history";
          if (loading && !latest) subline = "…";
          else if (latest) {
            const top = topSetValue(latest, bw);
            subline = `${bw ? `×${top}` : `${formatKg(top)} kg`} · ${relativeDateLabel(latest.date)}`;
          }

          return (
            <button
              key={cfg.name}
              type="button"
              onClick={() => setOpen(cfg)}
              className="relative flex min-h-[92px] flex-col justify-between rounded-2xl border border-line bg-surface p-3 text-left transition-transform active:scale-[0.97]"
            >
              <span className="pr-6 font-display text-[17px] font-semibold uppercase leading-[1.05] tracking-wide">
                {cfg.name}
              </span>
              <span className="font-mono text-xs text-dim">{subline}</span>

              {(done || pending) && (
                <span
                  className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full ${
                    pending ? "bg-okay/20 text-okay" : "bg-accent/20 text-accent"
                  }`}
                  aria-label={pending ? "Waiting to sync" : "Logged today"}
                >
                  {pending ? (
                    <span className="h-1.5 w-1.5 animate-done rounded-full bg-okay" />
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path
                        d="M4 10.5l4 4 8-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        // Keyed by exercise: switching exercises must never carry set state over.
        <LoggingCard
          key={open.name}
          cfg={open}
          last={latestFor(open.name)}
          onClose={() => setOpen(null)}
        />
      )}
    </main>
  );
}
