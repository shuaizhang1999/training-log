import type { Entry, LoggedSet, ParsedEntry, Side } from "./types";

/**
 * Encodes/decodes the sheet's data contract. One row per exercise per session:
 *
 *   Date | Day | Exercise | S1 kg | S1 reps | S2 kg | S2 reps | S3 kg | S3 reps | Reps in reserve | Notes
 *
 * - Bodyweight sets store kg as 0. A blank kg/reps pair means "set not performed".
 * - "Reps in reserve" stores the effort word: easy | ok | hard.
 * - Sets beyond 3 overflow into Notes as "S4: 20x8", or "S4: 0x12 (L)" for one side
 *   of a unilateral exercise.
 *
 * Unilateral exercises (set numbers count per side — left set 4 is "S4 ... (L)"):
 * - When left and right set n match exactly, the kg/reps columns hold that shared
 *   value, like a manual log would.
 * - When they differ, the columns hold the LEFT values and the right side is spelled
 *   out in Notes as "S2: 10x8 (R)".
 * - When only one side did set n (n ≤ 3), the columns hold that side and Notes gets
 *   "S2: (L only)".
 * - Sets 4+ always go to Notes, tagged with their side.
 * The parser understands all of these, so pre-fill reconstructs asymmetric sessions.
 */

export const SHEET_COLUMNS = 11;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Local date on the device, yyyy-mm-dd (never UTC — a 23:30 workout stays on its day). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Mon/Tue/... for a yyyy-mm-dd string, computed in local time. */
export function dayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

/** 34.3 -> "34.3", 20 -> "20". Weights are kept to one decimal. */
export function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return String(rounded);
}

function overflowToken(n: number, s: LoggedSet, side?: Side): string {
  const tag = side ? ` (${side})` : "";
  return `S${n}: ${formatKg(s.kg)}x${s.reps}${tag}`;
}

function sameSet(a: LoggedSet, b: LoggedSet): boolean {
  return a.kg === b.kg && a.reps === b.reps;
}

interface ColumnData {
  /** Up to 3 kg/reps pairs for the columns; null = blank pair. */
  pairs: (LoggedSet | null)[];
  /** Machine-written Notes tokens (overflow sets, side annotations). */
  tokens: string[];
}

function encodeBilateral(sets: LoggedSet[]): ColumnData {
  const pairs = sets.slice(0, 3).map((s) => s as LoggedSet | null);
  const tokens = sets.slice(3).map((s, i) => overflowToken(i + 4, s));
  return { pairs, tokens };
}

function encodeUnilateral(sets: LoggedSet[]): ColumnData {
  const left = sets.filter((s) => s.side === "L");
  const right = sets.filter((s) => s.side === "R");
  const pairs: (LoggedSet | null)[] = [];
  const tokens: string[] = [];
  const maxN = Math.max(left.length, right.length);

  for (let i = 0; i < Math.min(maxN, 3); i++) {
    const l = left[i];
    const r = right[i];
    if (l && r) {
      pairs.push(l);
      if (!sameSet(l, r)) tokens.push(overflowToken(i + 1, r, "R"));
    } else {
      const only = (l ?? r)!;
      pairs.push(only);
      tokens.push(`S${i + 1}: (${only.side} only)`);
    }
  }
  for (let i = 3; i < maxN; i++) {
    const l = left[i];
    const r = right[i];
    if (l) tokens.push(overflowToken(i + 1, l, "L"));
    if (r) tokens.push(overflowToken(i + 1, r, "R"));
  }
  return { pairs, tokens };
}

/**
 * Build the 11 cells for one appended row. Cell types are preserved (numbers as
 * numbers) so USER_ENTERED writes real numeric cells; unperformed sets stay blank.
 */
export function entryToRow(entry: Entry, unilateral: boolean): (string | number)[] {
  const { pairs, tokens } = unilateral
    ? encodeUnilateral(entry.sets)
    : encodeBilateral(entry.sets);

  const cells: (string | number)[] = [entry.date, dayName(entry.date), entry.exercise];
  for (let i = 0; i < 3; i++) {
    const p = pairs[i] ?? null;
    cells.push(p ? Math.round(p.kg * 10) / 10 : "");
    cells.push(p ? p.reps : "");
  }
  cells.push(entry.effort);

  const noteParts = [...tokens];
  const userNote = entry.notes?.trim();
  if (userNote) noteParts.push(userNote);
  cells.push(noteParts.join("; "));

  return cells;
}

// ---------------------------------------------------------------------------
// Reading rows back
// ---------------------------------------------------------------------------

/** Google serial date number -> yyyy-mm-dd (serial 25569 = 1970-01-01, UTC-based). */
function serialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeDate(cell: unknown): string {
  if (typeof cell === "number" && isFinite(cell)) return serialToDate(cell);
  const s = String(cell ?? "").trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : s;
}

function toNumber(cell: unknown): number | null {
  if (typeof cell === "number") return isFinite(cell) ? cell : null;
  const s = String(cell ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

const OVERFLOW_RE = /S(\d+)\s*:\s*(-?[\d.,]+)\s*[x×]\s*(\d+)\s*(?:\(\s*([LR])\s*\))?/gi;
const ONLY_RE = /S(\d+)\s*:\s*\(\s*([LR])\s+only\s*\)/gi;

interface NotesInfo {
  overflow: { n: number; kg: number; reps: number; side?: Side }[];
  only: { n: number; side: Side }[];
  userNote: string;
}

function parseNotes(raw: string): NotesInfo {
  const overflow: NotesInfo["overflow"] = [];
  const only: NotesInfo["only"] = [];
  let rest = raw;

  rest = rest.replace(ONLY_RE, (_m, n: string, side: string) => {
    only.push({ n: parseInt(n, 10), side: side.toUpperCase() as Side });
    return ";";
  });
  rest = rest.replace(OVERFLOW_RE, (_m, n: string, kg: string, reps: string, side?: string) => {
    overflow.push({
      n: parseInt(n, 10),
      kg: parseFloat(kg.replace(",", ".")),
      reps: parseInt(reps, 10),
      side: side ? (side.toUpperCase() as Side) : undefined,
    });
    return ";";
  });

  const userNote = rest
    .split(";")
    .map((part) => part.replace(/^[\s;,—-]+|[\s;,—-]+$/g, ""))
    .filter(Boolean)
    .join("; ");

  return { overflow, only, userNote };
}

/**
 * Reconstruct an entry from one sheet row. For unilateral exercises the column
 * pairs are expanded back into L/R sets and Notes annotations are applied, so an
 * asymmetric "4 left / 3 right" session round-trips faithfully.
 */
export function rowToEntry(row: unknown[], unilateral: boolean): ParsedEntry {
  const date = normalizeDate(row[0]);
  const exercise = String(row[2] ?? "").trim();
  const effort = String(row[9] ?? "").trim().toLowerCase();
  const { overflow, only, userNote } = parseNotes(String(row[10] ?? ""));

  const columnSets: { n: number; kg: number; reps: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const kg = toNumber(row[3 + i * 2]);
    const reps = toNumber(row[4 + i * 2]);
    if (kg !== null && reps !== null) columnSets.push({ n: i + 1, kg, reps: Math.round(reps) });
  }

  let sets: LoggedSet[];
  if (!unilateral) {
    sets = columnSets.map(({ kg, reps }) => ({ kg, reps }));
    for (const o of overflow.sort((a, b) => a.n - b.n)) {
      sets.push({ kg: o.kg, reps: o.reps });
    }
  } else {
    const bySide: Record<Side, Map<number, LoggedSet>> = { L: new Map(), R: new Map() };
    for (const { n, kg, reps } of columnSets) {
      bySide.L.set(n, { kg, reps, side: "L" });
      bySide.R.set(n, { kg, reps, side: "R" });
    }
    // "S2: (L only)" -> drop the mirrored right-side copy.
    for (const o of only) {
      const other: Side = o.side === "L" ? "R" : "L";
      bySide[other].delete(o.n);
    }
    // "S2: 10x8 (R)" -> right side differed; "S4: 0x12 (L)" -> extra left set.
    for (const o of overflow) {
      const side = o.side ?? "L";
      bySide[side].set(o.n, { kg: o.kg, reps: o.reps, side });
    }
    sets = [];
    const maxN = Math.max(0, ...bySide.L.keys(), ...bySide.R.keys());
    for (let n = 1; n <= maxN; n++) {
      const l = bySide.L.get(n);
      const r = bySide.R.get(n);
      if (l) sets.push(l);
      if (r) sets.push(r);
    }
  }

  return { date, exercise, sets, effort, notes: userNote };
}

// ---------------------------------------------------------------------------
// Display helpers (shared by "Last time" line and history list)
// ---------------------------------------------------------------------------

function summarizeGroup(sets: LoggedSet[], bodyweight: boolean): string {
  if (sets.length === 0) return "—";
  const kgs = sets.map((s) => formatKg(s.kg));
  const reps = sets.map((s) => s.reps).join("/");
  if (bodyweight) return reps;
  const allSame = kgs.every((k) => k === kgs[0]);
  const kgPart = allSame ? kgs[0] : kgs.join("/");
  return `${kgPart} kg — ${reps}`;
}

/** "34.3 kg — 10/10/10 (hard)", or "L 12/12 · R 12/12 (ok)" when sides differ. */
export function summarizeEntry(
  entry: Pick<ParsedEntry, "sets" | "effort">,
  opts: { unilateral: boolean; bodyweight: boolean }
): string {
  let body: string;
  if (!opts.unilateral) {
    body = summarizeGroup(entry.sets, opts.bodyweight);
  } else {
    const left = entry.sets.filter((s) => s.side === "L");
    const right = entry.sets.filter((s) => s.side === "R");
    const symmetric =
      left.length === right.length && left.every((l, i) => sameSet(l, right[i]));
    body = symmetric
      ? summarizeGroup(left, opts.bodyweight)
      : `L ${summarizeGroup(left, opts.bodyweight)} · R ${summarizeGroup(right, opts.bodyweight)}`;
  }
  if (opts.bodyweight && body !== "—") body = `BW — ${body}`;
  return entry.effort ? `${body} (${entry.effort})` : body;
}

/** Top-set number for the sparkline: heaviest kg, or most reps for bodyweight moves. */
export function topSetValue(entry: ParsedEntry, bodyweight: boolean): number {
  if (entry.sets.length === 0) return 0;
  return Math.max(...entry.sets.map((s) => (bodyweight ? s.reps : s.kg)));
}

/** "today" / "yesterday" / "5d ago" / "Jun 12" for a yyyy-mm-dd string. */
export function relativeDateLabel(date: string, today: string = localDateString()): string {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const days = Math.round((parse(today) - parse(date)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 21) return `${days}d ago`;
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en", { month: "short", day: "numeric" });
  return label;
}
