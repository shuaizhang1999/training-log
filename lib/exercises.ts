/**
 * The training program. Edit this file to add/remove exercises or tweak
 * rest times — everything in the UI is driven from here. The weight stepper
 * always moves in whole 1 kg steps; odd stack values can be typed by
 * long-pressing the number, and `stackNote` can list them as a hint.
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
  /** Bodyweight exercise: no weight UI, kg logged as 0. */
  bodyweight: boolean;
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
  { name: "Lat pulldown",             sets: 3, repsMin: 8,  repsMax: 12, bodyweight: false, restSec: 120, unilateral: false },
  { name: "Chest-supported seated row", sets: 3, repsMin: 10, repsMax: 12, bodyweight: false, restSec: 90,  unilateral: false },
  { name: "Incline dumbbell press",   sets: 3, repsMin: 8,  repsMax: 12, bodyweight: false, restSec: 120, unilateral: false },
  { name: "Converging shoulder press", sets: 3, repsMin: 8,  repsMax: 12, bodyweight: false, restSec: 90,  unilateral: false },
  { name: "Knee push-up",             sets: 3, repsMin: 6,  repsMax: 8,  bodyweight: true,  restSec: 90,  unilateral: false },
  { name: "Dumbbell lateral raise",   sets: 3, repsMin: 10, repsMax: 12, bodyweight: false, restSec: 60,  unilateral: false },
  { name: "Face pull",                sets: 3, repsMin: 15, repsMax: 20, bodyweight: false, restSec: 45,  unilateral: false },
  { name: "Pallof press",             sets: 3, repsMin: 12, repsMax: 15, bodyweight: false, restSec: 45,  unilateral: true },
  { name: "Dead bug",                 sets: 3, repsMin: 10, repsMax: 12, bodyweight: true,  restSec: 45,  unilateral: false },
  { name: "Goblet squat",             sets: 3, repsMin: 8,  repsMax: 10, bodyweight: false, restSec: 120, unilateral: false },
  { name: "Bulgarian split squat",    sets: 3, repsMin: 8,  repsMax: 10, bodyweight: false, restSec: 90,  unilateral: true },
  { name: "Figure-four glute bridge", sets: 3, repsMin: 8,  repsMax: 12, bodyweight: true,  restSec: 90,  unilateral: true },
  { name: "Side-lying hip abduction", sets: 3, repsMin: 15, repsMax: 15, bodyweight: true,  restSec: 45,  unilateral: true },
  { name: "Lateral lunge",            sets: 2, repsMin: 10, repsMax: 10, bodyweight: true,  restSec: 60,  unilateral: true },
  { name: "Hammer curl",              sets: 3, repsMin: 10, repsMax: 12, bodyweight: false, restSec: 60,  unilateral: false },
  { name: "Rope triceps pushdown",    sets: 3, repsMin: 10, repsMax: 12, bodyweight: false, restSec: 60,  unilateral: false },
  { name: "Overhead cable triceps extension", sets: 3, repsMin: 10, repsMax: 12, bodyweight: false, restSec: 60, unilateral: false },
  { name: "Reverse curl",             sets: 2, repsMin: 15, repsMax: 20, bodyweight: false, restSec: 45,  unilateral: false },
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
  return cfg.bodyweight;
}

export function repRangeLabel(cfg: ExerciseConfig): string {
  return cfg.repsMin === cfg.repsMax
    ? `${cfg.sets}×${cfg.repsMin}`
    : `${cfg.sets}×${cfg.repsMin}–${cfg.repsMax}`;
}
