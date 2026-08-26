import { NextResponse } from "next/server";
import { EXERCISES, matchesExerciseName } from "@/lib/exercises";
import { rowToEntry } from "@/lib/rowcodec";
import { readAllRows } from "@/lib/sheets";
import type { HistoryMap } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One sheet read serving both features that look backwards:
 * - pre-fill on the logging card uses history[exercise][0] (most recent row)
 * - the history view shows all five entries per exercise
 */
export async function GET() {
  try {
    const rows = await readAllRows();
    const history: HistoryMap = {};

    for (const cfg of EXERCISES) {
      const entries = rows
        .filter((row) => matchesExerciseName(cfg, String(row[2] ?? "")))
        .map((row) => rowToEntry(row, cfg.unilateral));
      // Append-only sheet means file order is chronological; sort by date as a
      // safety net for hand-edited rows, then keep the 5 newest, newest first.
      entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      history[cfg.name] = entries.slice(-5).reverse();
    }

    return NextResponse.json({ history, fetchedAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sheet read failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
