"use client";

import { useData, useTimer } from "../providers";
import { Sparkline } from "@/components/Sparkline";
import { SyncBadge } from "@/components/SyncBadge";
import { EXERCISES, isBodyweight } from "@/lib/exercises";
import { summarizeEntry, topSetValue } from "@/lib/rowcodec";

function shortDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
  });
}

/** Read-only: last 5 sessions per exercise + top-set trend. */
export default function HistoryPage() {
  const { history, loading, stale, hasPending } = useData();
  const timerActive = useTimer().active !== null;

  const signOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  };

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
            History
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

      {EXERCISES.map((cfg) => {
        const entries = history[cfg.name] ?? [];
        const bw = isBodyweight(cfg);
        // entries come newest-first; the sparkline reads oldest → newest.
        const trend = [...entries].reverse().map((e) => topSetValue(e, bw));

        return (
          <section key={cfg.name} className="mb-6">
            <div className="mb-2 flex items-end justify-between gap-3 border-b border-line pb-2">
              <h2 className="min-w-0 font-display text-lg font-semibold uppercase leading-tight tracking-wide">
                {cfg.name}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {hasPending(cfg.name) && (
                  <span className="rounded-full border border-okay/40 bg-okay/10 px-2 py-0.5 font-mono text-[10px] text-okay">
                    queued
                  </span>
                )}
                <Sparkline values={trend} unit={bw ? "reps" : "kg"} />
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="font-mono text-xs text-dim">{loading ? "…" : "No sessions yet"}</p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e, i) => (
                  <li key={`${e.date}-${i}`} className="flex items-baseline gap-3">
                    <span className="w-14 shrink-0 font-mono text-xs text-dim">
                      {shortDate(e.date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm">
                        {summarizeEntry(e, { unilateral: cfg.unilateral, bodyweight: bw })}
                      </div>
                      {e.notes && <div className="truncate text-xs text-dim">{e.notes}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <footer className="mt-10 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="font-mono text-xs text-dim underline underline-offset-4"
        >
          Sign out
        </button>
      </footer>
    </main>
  );
}
