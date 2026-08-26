import type { Entry } from "./types";

/**
 * The never-lose-a-set queue. Every save lands here first (localStorage), then
 * syncs to /api/log in order. If the network is down or the call fails, the
 * entry stays queued and retries automatically — on reconnect, on returning to
 * the app, and on a capped exponential backoff.
 *
 * Retries send `dedupe: true` so a request whose response was lost mid-flight
 * is not appended to the sheet twice.
 *
 * Plain module singleton (not React state) so the queue survives navigation and
 * can be read via useSyncExternalStore from any component.
 */

export interface OutboxItem {
  entry: Entry;
  attempts: number;
  lastError?: string;
}

const STORAGE_KEY = "tl-outbox-v1";

let items: OutboxItem[] = [];
let loaded = false;
let syncing = false;
let version = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let onSynced: (() => void) | null = null;

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) items = JSON.parse(raw) as OutboxItem[];
  } catch {
    items = [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full/blocked — the queue still lives in memory for this session
  }
}

function bump(): void {
  version++;
  listeners.forEach((l) => l());
}

// --- reads (for useSyncExternalStore) ---------------------------------------

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

export function getServerVersion(): number {
  return 0;
}

export function pendingItems(): OutboxItem[] {
  ensureLoaded();
  return items;
}

export function pendingCount(): number {
  ensureLoaded();
  return items.length;
}

export function isSyncing(): boolean {
  return syncing;
}

// --- writes -----------------------------------------------------------------

export function setOnSynced(cb: (() => void) | null): void {
  onSynced = cb;
}

export function enqueue(entry: Entry): void {
  ensureLoaded();
  items = [...items, { entry, attempts: 0 }];
  persist();
  bump();
  void syncNow();
}

function markHeadError(message: string): void {
  const head = items[0];
  if (!head) return;
  items = [{ ...head, attempts: head.attempts + 1, lastError: message }, ...items.slice(1)];
  persist();
  bump();
}

function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  const attempts = items[0]?.attempts ?? 1;
  const delay = Math.min(60_000, 5_000 * 2 ** Math.min(attempts - 1, 4));
  retryTimer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  ensureLoaded();
  if (syncing || items.length === 0) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    scheduleRetry();
    return;
  }

  syncing = true;
  bump();
  let progressed = false;
  try {
    while (items.length > 0) {
      const item = items[0];
      let res: Response;
      try {
        res = await fetch("/api/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entry: item.entry, dedupe: item.attempts > 0 }),
        });
      } catch {
        markHeadError("offline");
        break;
      }

      if (res.ok) {
        items = items.slice(1);
        persist();
        progressed = true;
        bump();
        continue;
      }

      if (res.status === 401) {
        markHeadError("signed out");
        if (window.location.pathname !== "/login") window.location.href = "/login";
        break;
      }

      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // keep the HTTP status message
      }
      markHeadError(message);
      break;
    }
  } finally {
    syncing = false;
    bump();
    if (items.length > 0) scheduleRetry();
    else if (retryTimer) clearTimeout(retryTimer);
  }
  if (progressed) onSynced?.();
}

/** Wire up the automatic retry triggers. Call once from the app shell. */
export function initOutbox(): void {
  ensureLoaded();
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  void syncNow();
}
