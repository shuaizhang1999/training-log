"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import * as outbox from "@/lib/outbox";
import { localDateString } from "@/lib/rowcodec";
import type { Entry, HistoryMap, ParsedEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Rest timer — global so the countdown survives navigating between screens.
// ---------------------------------------------------------------------------

export interface ActiveTimer {
  exercise: string;
  /** Absolute end timestamp, so backgrounding the phone never drifts the clock. */
  endsAt: number;
  totalSec: number;
}

interface TimerContextValue {
  active: ActiveTimer | null;
  start(exercise: string, seconds: number): void;
  extend(seconds: number): void;
  dismiss(): void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer outside Providers");
  return ctx;
}

function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        lockRef.current = await navigator.wakeLock?.request("screen");
        if (cancelled) void lockRef.current?.release();
      } catch {
        // wake lock is a nice-to-have; ignore denial
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}

// ---------------------------------------------------------------------------
// Sheet data — one /api/history fetch feeds pre-fill, the grid and history.
// ---------------------------------------------------------------------------

interface DataContextValue {
  history: HistoryMap;
  /** True until the first fetch (or snapshot restore) finishes. */
  loading: boolean;
  /** True when showing a stored copy because the network/sheet is unreachable. */
  stale: boolean;
  refresh(): void;
  /** Most recent entry for an exercise, considering unsynced outbox entries too. */
  latestFor(exercise: string): ParsedEntry | null;
  savedToday(exercise: string): boolean;
  hasPending(exercise: string): boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData outside Providers");
  return ctx;
}

const SNAPSHOT_KEY = "tl-history-snapshot-v1";

function entryToParsed(entry: Entry): ParsedEntry {
  return {
    date: entry.date,
    exercise: entry.exercise,
    sets: entry.sets,
    effort: entry.effort,
    notes: entry.notes ?? "",
  };
}

export function Providers({ children }: { children: ReactNode }) {
  // --- timer ---
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const start = useCallback((exercise: string, seconds: number) => {
    setActive({ exercise, endsAt: Date.now() + seconds * 1000, totalSec: seconds });
  }, []);
  const extend = useCallback((seconds: number) => {
    setActive((cur) => {
      if (!cur) return cur;
      const base = Math.max(cur.endsAt, Date.now());
      return { ...cur, endsAt: base + seconds * 1000, totalSec: cur.totalSec + seconds };
    });
  }, []);
  const dismiss = useCallback(() => setActive(null), []);
  useWakeLock(active !== null);
  const timerValue = useMemo(
    () => ({ active, start, extend, dismiss }),
    [active, start, extend, dismiss]
  );

  // --- sheet data ---
  const [history, setHistory] = useState<HistoryMap>({});
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const fetchingRef = useRef(false);

  const refresh = useCallback(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/history", { cache: "no-store" });
        if (res.status === 401) {
          if (window.location.pathname !== "/login") window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { history: HistoryMap };
        setHistory(body.history);
        setStale(false);
        try {
          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(body.history));
        } catch {
          // ignore storage failures
        }
      } catch {
        // Offline or sheet unreachable: fall back to the last good copy.
        try {
          const raw = localStorage.getItem(SNAPSHOT_KEY);
          if (raw) setHistory(JSON.parse(raw) as HistoryMap);
        } catch {
          // nothing stored — empty history it is
        }
        setStale(true);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    })();
  }, []);

  // No data fetching or sync on the login screen — there's no session yet,
  // and a 401-triggered redirect from here would reload /login forever.
  const pathname = usePathname();
  const onLoginPage = pathname === "/login";

  useEffect(() => {
    if (onLoginPage) return;
    outbox.initOutbox();
    outbox.setOnSynced(() => refresh());
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      outbox.setOnSynced(null);
    };
  }, [refresh, onLoginPage]);

  // Re-render whenever the outbox changes so pending entries show up instantly.
  const outboxVersion = useSyncExternalStore(
    outbox.subscribe,
    outbox.getVersion,
    outbox.getServerVersion
  );

  const dataValue = useMemo<DataContextValue>(() => {
    const pendingByExercise = new Map<string, Entry[]>();
    for (const item of outbox.pendingItems()) {
      const list = pendingByExercise.get(item.entry.exercise) ?? [];
      list.push(item.entry);
      pendingByExercise.set(item.entry.exercise, list);
    }

    const latestFor = (exercise: string): ParsedEntry | null => {
      const pending = pendingByExercise.get(exercise);
      const queued = pending?.length ? entryToParsed(pending[pending.length - 1]) : null;
      const server = history[exercise]?.[0] ?? null;
      if (queued && server) return queued.date >= server.date ? queued : server;
      return queued ?? server;
    };

    return {
      history,
      loading,
      stale,
      refresh,
      latestFor,
      savedToday: (exercise) => latestFor(exercise)?.date === localDateString(),
      hasPending: (exercise) => (pendingByExercise.get(exercise)?.length ?? 0) > 0,
    };
    // outboxVersion is the invalidation signal for pending items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, loading, stale, refresh, outboxVersion]);

  // --- service worker (production only, so dev never serves stale chunks) ---
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <TimerContext.Provider value={timerValue}>
      <DataContext.Provider value={dataValue}>{children}</DataContext.Provider>
    </TimerContext.Provider>
  );
}
