"use client";

import { useSyncExternalStore } from "react";
import * as outbox from "@/lib/outbox";

/**
 * The subtle "N unsynced" pill. Invisible when everything reached the sheet;
 * tapping it retries immediately instead of waiting for the backoff.
 */
export function SyncBadge() {
  useSyncExternalStore(outbox.subscribe, outbox.getVersion, outbox.getServerVersion);
  const count = outbox.pendingCount();
  const syncing = outbox.isSyncing();
  const lastError = outbox.pendingItems()[0]?.lastError;

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void outbox.syncNow()}
      title={lastError ? `Last error: ${lastError} — tap to retry` : "Tap to retry"}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-okay/40 bg-okay/10 px-3 font-mono text-xs font-semibold text-okay active:scale-95"
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-okay ${syncing ? "animate-done" : ""}`} />
      {count} unsynced
    </button>
  );
}
