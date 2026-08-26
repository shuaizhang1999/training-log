export type Effort = "easy" | "ok" | "hard";
export type Side = "L" | "R";

export const EFFORTS: readonly Effort[] = ["easy", "ok", "hard"];

/** One performed set. `side` is present only for unilateral exercises. */
export interface LoggedSet {
  kg: number;
  reps: number;
  side?: Side;
}

/** A finished exercise entry, as produced by the logging card and queued in the outbox. */
export interface Entry {
  /** Client-generated UUID, used for outbox bookkeeping and retry dedupe. */
  id: string;
  /** Local date the workout happened, yyyy-mm-dd. Captured at save time on the phone. */
  date: string;
  /** Exact exercise name as it appears in the sheet. */
  exercise: string;
  /** Completed sets, in the order performed. */
  sets: LoggedSet[];
  effort: Effort;
  /** Free-text note typed by the user (overflow sets are added separately by the codec). */
  notes?: string;
}

/** An entry read back from the sheet (one row), reconstructed including overflow sets. */
export interface ParsedEntry {
  date: string;
  exercise: string;
  sets: LoggedSet[];
  /** Effort word from the "Reps in reserve" column; empty string if the cell was blank. */
  effort: string;
  /** User note with the machine-written overflow tokens stripped out. */
  notes: string;
}

/** Shape returned by GET /api/history: newest first, at most 5 per exercise. */
export type HistoryMap = Record<string, ParsedEntry[]>;
