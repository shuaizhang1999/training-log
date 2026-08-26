import { NextResponse, type NextRequest } from "next/server";
import { getExercise } from "@/lib/exercises";
import { entryToRow, rowToEntry } from "@/lib/rowcodec";
import { appendRow, readAllRows } from "@/lib/sheets";
import { EFFORTS, type Entry, type LoggedSet } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Append one exercise entry as one sheet row.
 *
 * `dedupe: true` is sent only by outbox retries: if the first attempt actually
 * reached Google but the response was lost on a flaky gym connection, the retry
 * finds the identical recent row and reports success instead of appending a
 * duplicate. First attempts never dedupe, so intentionally logging the same
 * numbers twice in a day still works.
 */

interface LogRequest {
  entry: Entry;
  dedupe?: boolean;
}

function parseSets(raw: unknown, unilateral: boolean): LoggedSet[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "at least one completed set is required";
  if (raw.length > 20) return "too many sets";
  const sets: LoggedSet[] = [];
  for (const item of raw) {
    const kg = typeof item?.kg === "number" ? item.kg : NaN;
    const reps = typeof item?.reps === "number" ? item.reps : NaN;
    const side = item?.side;
    if (!isFinite(kg) || kg < 0 || kg > 999) return "invalid kg value";
    if (!Number.isInteger(reps) || reps < 0 || reps > 200) return "invalid reps value";
    if (unilateral) {
      if (side !== "L" && side !== "R") return "unilateral sets need side L or R";
      sets.push({ kg: Math.round(kg * 10) / 10, reps, side });
    } else {
      if (side !== undefined) return "side given for a bilateral exercise";
      sets.push({ kg: Math.round(kg * 10) / 10, reps });
    }
  }
  return sets;
}

function validate(body: LogRequest): { entry: Entry; unilateral: boolean } | string {
  const e = body?.entry;
  if (!e || typeof e !== "object") return "missing entry";
  if (typeof e.exercise !== "string") return "missing exercise";
  const cfg = getExercise(e.exercise);
  if (!cfg) return `unknown exercise: ${e.exercise}`;
  if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return "invalid date";
  if (!EFFORTS.includes(e.effort)) return "effort must be easy, ok or hard";
  if (e.notes !== undefined && typeof e.notes !== "string") return "invalid notes";
  if ((e.notes ?? "").length > 500) return "notes too long";

  const sets = parseSets(e.sets, cfg.unilateral);
  if (typeof sets === "string") return sets;

  return {
    unilateral: cfg.unilateral,
    entry: {
      id: String(e.id ?? ""),
      date: e.date,
      exercise: cfg.name,
      sets,
      effort: e.effort,
      notes: e.notes?.trim() || undefined,
    },
  };
}

function setsEqual(a: LoggedSet[], b: LoggedSet[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => s.kg === b[i].kg && s.reps === b[i].reps && s.side === b[i].side)
  );
}

async function identicalRecentRowExists(entry: Entry, unilateral: boolean): Promise<boolean> {
  const rows = await readAllRows();
  for (const row of rows.slice(-60)) {
    const parsed = rowToEntry(row, unilateral);
    if (
      parsed.date === entry.date &&
      parsed.exercise === entry.exercise &&
      parsed.effort === entry.effort &&
      parsed.notes === (entry.notes ?? "") &&
      setsEqual(parsed.sets, entry.sets)
    ) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: LogRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const result = validate(body);
  if (typeof result === "string") {
    return NextResponse.json({ error: result }, { status: 400 });
  }

  try {
    if (body.dedupe && (await identicalRecentRowExists(result.entry, result.unilateral))) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    await appendRow(entryToRow(result.entry, result.unilateral));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sheet append failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
