/**
 * The training program. Edit this file to add/remove exercises or tweak
 * increments and rest times — everything in the UI is driven from here.
 *
 * `name` must match the Exercise column in the sheet exactly, because it is
 * used both to write new rows and to find previous rows for pre-fill.
 */
export interface ExerciseConfig {
  name: string;
  /** Default number of sets (per side, for unilateral exercises). */
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Weight stepper increment in kg. 0 means bodyweight: no weight UI, kg logged as 0. */
  kgStep: number;
  /** Rest timer duration after completing a set. */
  restSec: number;
  /** Unilateral = performed one side at a time; sets are labeled L/R. */
  unilateral: boolean;
  /** Optional hint shown on the logging card (e.g. cable stack values). */
  stackNote?: string;
  /**
   * Old hand-written spellings of this exercise in the sheet. Reads (pre-fill,
   * history) match these too; new rows always use the canonical `name`.
   */
  aliases?: string[];
}

export const EXERCISES: readonly ExerciseConfig[] = [
  { name: "Lat pulldown",             sets: 3, repsMin: 8,  repsMax: 12, kgStep: 2.3, restSec: 120, unilateral: false },
  { name: "Seated cable row",         sets: 3, repsMin: 10, repsMax: 12, kgStep: 3.5, restSec: 90,  unilateral: false, stackNote: "stack 25 · 28.5 · 32 · 35.5" },
  { name: "Incline dumbbell press",   sets: 3, repsMin: 8,  repsMax: 12, kgStep: 2,   restSec: 120, unilateral: false },
  { name: "Knee push-up",             sets: 3, repsMin: 6,  repsMax: 8,  kgStep: 0,   restSec: 90,  unilateral: false, aliases: ["push up on knee"] },
  { name: "Dumbbell lateral raise",   sets: 3, repsMin: 10, repsMax: 12, kgStep: 1,   restSec: 60,  unilateral: false },
  { name: "Face pull",                sets: 3, repsMin: 15, repsMax: 20, kgStep: 2.3, restSec: 45,  unilateral: false },
  { name: "Pallof press",             sets: 3, repsMin: 12, repsMax: 15, kgStep: 3.5, restSec: 45,  unilateral: true },
  { name: "Goblet squat",             sets: 3, repsMin: 8,  repsMax: 10, kgStep: 2.5, restSec: 120, unilateral: false },
  { name: "Bulgarian split squat",    sets: 3, repsMin: 8,  repsMax: 10, kgStep: 2.5, restSec: 90,  unilateral: true },
  { name: "Figure-four glute bridge", sets: 3, repsMin: 8,  repsMax: 12, kgStep: 0,   restSec: 90,  unilateral: true },
  { name: "Side-lying hip abduction", sets: 3, repsMin: 15, repsMax: 15, kgStep: 0,   restSec: 45,  unilateral: true },
  { name: "Lateral lunge",            sets: 2, repsMin: 10, repsMax: 10, kgStep: 0,   restSec: 60,  unilateral: true },
  { name: "Hammer curl",              sets: 3, repsMin: 10, repsMax: 12, kgStep: 1,   restSec: 60,  unilateral: false },
  { name: "Rope triceps pushdown",    sets: 3, repsMin: 10, repsMax: 12, kgStep: 2.3, restSec: 60,  unilateral: false },
  { name: "Reverse curl",             sets: 2, repsMin: 15, repsMax: 20, kgStep: 1,   restSec: 45,  unilateral: false },
];

export function getExercise(name: string): ExerciseConfig | undefined {
  return EXERCISES.find((e) => e.name === name);
}

/** Case-insensitive match against the canonical name or any legacy alias. */
export function matchesExerciseName(cfg: ExerciseConfig, raw: string): boolean {
  const n = raw.trim().toLowerCase();
  if (n === cfg.name.toLowerCase()) return true;
  return cfg.aliases?.some((a) => a.toLowerCase() === n) ?? false;
}

export function isBodyweight(cfg: ExerciseConfig): boolean {
  return cfg.kgStep === 0;
}

export function repRangeLabel(cfg: ExerciseConfig): string {
  return cfg.repsMin === cfg.repsMax
    ? `${cfg.sets}×${cfg.repsMin}`
    : `${cfg.sets}×${cfg.repsMin}–${cfg.repsMax}`;
}
