"use client";

import { useEffect, useRef, useState } from "react";
import { useTimer } from "@/app/providers";
import { EffortChips } from "./EffortChips";
import { SetRow } from "./SetRow";
import { isBodyweight, repRangeLabel, type ExerciseConfig } from "@/lib/exercises";
import { primeAudio } from "@/lib/beep";
import * as outbox from "@/lib/outbox";
import { localDateString, relativeDateLabel, summarizeEntry } from "@/lib/rowcodec";
import type { Effort, Entry, ParsedEntry, Side } from "@/lib/types";

interface SetDraft {
  id: number;
  side?: Side;
  kg: number;
  reps: number;
  done: boolean;
}

/**
 * Pre-fill, the whole point: every set starts at last session's kg/reps for
 * this exercise (per side for unilateral moves), falling back to the config's
 * rep-range floor on a first session. Extra sets clone the previous set.
 */
function buildInitialRows(cfg: ExerciseConfig, last: ParsedEntry | null): SetDraft[] {
  const bw = isBodyweight(cfg);
  let id = 0;
  const mk = (side: Side | undefined, src: { kg: number; reps: number } | undefined): SetDraft => ({
    id: id++,
    side,
    kg: bw ? 0 : src?.kg ?? 0,
    reps: src?.reps ?? cfg.repsMin,
    done: false,
  });

  if (!cfg.unilateral) {
    const prev = last?.sets ?? [];
    const count = Math.max(cfg.sets, prev.length);
    return Array.from({ length: count }, (_, i) => mk(undefined, prev[i] ?? prev[prev.length - 1]));
  }

  const prevL = last?.sets.filter((s) => s.side === "L") ?? [];
  const prevR = last?.sets.filter((s) => s.side === "R") ?? [];
  const countL = Math.max(cfg.sets, prevL.length);
  const countR = Math.max(cfg.sets, prevR.length);
  const rows: SetDraft[] = [];
  for (let i = 0; i < Math.max(countL, countR); i++) {
    if (i < countL) rows.push(mk("L", prevL[i] ?? prevL[prevL.length - 1] ?? prevR[i]));
    if (i < countR) rows.push(mk("R", prevR[i] ?? prevR[prevR.length - 1] ?? prevL[i]));
  }
  return rows;
}

interface LoggingCardProps {
  cfg: ExerciseConfig;
  last: ParsedEntry | null;
  onClose(): void;
}

/**
 * In-progress work is checkpointed to localStorage per exercise, so a browser
 * reload mid-workout (phones do that under memory pressure) can't eat checked
 * sets: reopening the exercise the same day restores exactly where you were.
 */
interface CardDraft {
  date: string;
  rows: SetDraft[];
  effort: Effort | null;
  notes: string;
}

function draftKey(exercise: string): string {
  return `tl-draft-v1:${exercise}`;
}

function loadDraft(cfg: ExerciseConfig): CardDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(cfg.name));
    if (!raw) return null;
    const draft = JSON.parse(raw) as CardDraft;
    if (draft.date !== localDateString() || !Array.isArray(draft.rows)) {
      localStorage.removeItem(draftKey(cfg.name));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function LoggingCard({ cfg, last, onClose }: LoggingCardProps) {
  const timer = useTimer();
  const timerActive = timer.active !== null;
  const bw = isBodyweight(cfg);

  const [initial] = useState(() => {
    const draft = loadDraft(cfg);
    return {
      rows: draft?.rows ?? buildInitialRows(cfg, last),
      effort: draft?.effort ?? null,
      notes: draft?.notes ?? "",
    };
  });
  const [rows, setRows] = useState<SetDraft[]>(initial.rows);
  const [effort, setEffort] = useState<Effort | null>(initial.effort);
  const [notes, setNotes] = useState(initial.notes);
  const nextId = useRef(Math.max(0, ...initial.rows.map((r) => r.id)) + 1);

  // Checkpoint while dirty; drop the checkpoint when it holds nothing worth keeping.
  useEffect(() => {
    const dirty = rows.some((r) => r.done) || effort !== null || notes.trim() !== "";
    try {
      if (dirty) {
        const draft: CardDraft = { date: localDateString(), rows, effort, notes };
        localStorage.setItem(draftKey(cfg.name), JSON.stringify(draft));
      } else {
        localStorage.removeItem(draftKey(cfg.name));
      }
    } catch {
      // storage unavailable — in-memory state still works
    }
  }, [rows, effort, notes, cfg.name]);

  // The card covers the page; stop the page behind it from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const updateRow = (id: number, patch: Partial<Pick<SetDraft, "kg" | "reps">>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleRow = (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!row.done) {
      // Completing a set: unlock audio (user gesture) and start the rest timer.
      primeAudio();
      timer.start(cfg.name, cfg.restSec);
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  };

  const addSet = (side?: Side) => {
    setRows((rs) => {
      const sameKind = side ? rs.filter((r) => r.side === side) : rs;
      const src = sameKind[sameKind.length - 1] ?? rs[rs.length - 1];
      return [
        ...rs,
        {
          id: nextId.current++,
          side,
          kg: bw ? 0 : src?.kg ?? 0,
          reps: src?.reps ?? cfg.repsMin,
          done: false,
        },
      ];
    });
  };

  const completed = rows.filter((r) => r.done);
  const canSave = completed.length > 0 && effort !== null;

  const save = () => {
    if (!canSave || !effort) return;
    const entry: Entry = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      date: localDateString(),
      exercise: cfg.name,
      sets: completed.map(({ kg, reps, side }) =>
        cfg.unilateral ? { kg, reps, side } : { kg, reps }
      ),
      effort,
      notes: notes.trim() || undefined,
    };
    outbox.enqueue(entry);
    try {
      localStorage.removeItem(draftKey(cfg.name));
    } catch {
      // ignore
    }
    onClose();
  };

  const close = () => {
    if (
      completed.length > 0 &&
      !window.confirm(`Discard ${completed.length} completed set${completed.length > 1 ? "s" : ""}?`)
    ) {
      return;
    }
    try {
      localStorage.removeItem(draftKey(cfg.name));
    } catch {
      // ignore
    }
    onClose();
  };

  const saveLabel =
    completed.length === 0
      ? "Complete a set first"
      : !effort
        ? "Pick effort to save"
        : `Save ${completed.length} set${completed.length > 1 ? "s" : ""} → sheet`;

  // Count per-side set numbers for labels (L1, L2, R1... or Set 1, 2, 3).
  const sideCounters: Record<string, number> = {};
  const numberedRows = rows.map((row) => {
    const key = row.side ?? "both";
    sideCounters[key] = (sideCounters[key] ?? 0) + 1;
    return { row, index: sideCounters[key] };
  });

  return (
    <div
      className="animate-rise fixed inset-0 z-40 flex flex-col bg-bg"
      style={timerActive ? { paddingTop: "calc(env(safe-area-inset-top) + 70px)" } : undefined}
    >
      <header className={`border-b border-line bg-surface ${timerActive ? "" : "pt-safe"}`}>
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-bold uppercase leading-[1.05] tracking-wide">
              {cfg.name}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface2 text-dim active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p className="mt-1 font-mono text-sm">
            <span className="text-dim">Last time: </span>
            {last ? (
              <>
                {summarizeEntry(last, { unilateral: cfg.unilateral, bodyweight: bw })}
                <span className="text-dim"> · {relativeDateLabel(last.date)}</span>
              </>
            ) : (
              <span className="text-dim">first session</span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-xs text-accent">
              target {repRangeLabel(cfg)}
              {cfg.unilateral ? " / side" : ""}
            </span>
            <span className="rounded-md border border-line bg-surface2 px-2 py-1 font-mono text-xs text-dim">
              rest {cfg.restSec}s
            </span>
            {cfg.stackNote && (
              <span className="rounded-md border border-line bg-surface2 px-2 py-1 font-mono text-xs text-dim">
                {cfg.stackNote}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-2 px-4 py-3">
          {numberedRows.map(({ row, index }) => (
            <SetRow
              key={row.id}
              index={index}
              side={row.side}
              bodyweight={bw}
              kg={row.kg}
              reps={row.reps}
              done={row.done}
              onChange={(patch) => updateRow(row.id, patch)}
              onToggle={() => toggleRow(row.id)}
            />
          ))}

          {cfg.unilateral ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addSet("L")}
                className="h-12 rounded-xl border border-dashed border-line font-mono text-sm text-dim active:scale-95"
              >
                + set L
              </button>
              <button
                type="button"
                onClick={() => addSet("R")}
                className="h-12 rounded-xl border border-dashed border-line font-mono text-sm text-dim active:scale-95"
              >
                + set R
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addSet()}
              className="h-12 w-full rounded-xl border border-dashed border-line font-mono text-sm text-dim active:scale-95"
            >
              + add set
            </button>
          )}

          <div className="pt-2">
            <div className="mb-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-dim">
              Effort
            </div>
            <EffortChips value={effort} onChange={setEffort} />
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            placeholder="Notes — optional"
            className="h-12 w-full rounded-xl border border-line bg-surface2 px-3 text-base text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <footer className="border-t border-line bg-surface pb-safe">
        <div className="mx-auto max-w-md px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className={`h-14 w-full rounded-xl font-display text-base font-bold uppercase tracking-[0.14em] transition-all active:enabled:scale-[0.98] ${
              canSave ? "bg-accent text-black" : "bg-surface2 text-dim"
            }`}
          >
            {saveLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}
