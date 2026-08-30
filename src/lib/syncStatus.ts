// Last-synced tracking for the checked-state GET (docs/future-features-draft-20260829.md's
// "Last online at ___" feature, stage 1). Separate from checkedQueue.ts, which tracks
// pending PATCHes -- this tracks the GET side: when the app last successfully loaded
// checked state from the server, and whether the most recent attempt since then failed.

export interface SyncStatus {
  lastSuccessAt?: string; // ISO-8601
  lastFailureAt?: string; // ISO-8601
}

const SYNC_KEY_PREFIX = "bingo:checked:sync";

function syncKey(tripSlug: string): string {
  return `${SYNC_KEY_PREFIX}:${tripSlug}`;
}

export function readSyncStatus(tripSlug: string): SyncStatus {
  const raw = localStorage.getItem(syncKey(tripSlug));
  return raw ? (JSON.parse(raw) as SyncStatus) : {};
}

function writeSyncStatus(tripSlug: string, status: SyncStatus): void {
  localStorage.setItem(syncKey(tripSlug), JSON.stringify(status));
}

export function recordSyncSuccess(tripSlug: string): void {
  const status = readSyncStatus(tripSlug);
  writeSyncStatus(tripSlug, { ...status, lastSuccessAt: new Date().toISOString() });
}

export function recordSyncFailure(tripSlug: string): void {
  const status = readSyncStatus(tripSlug);
  writeSyncStatus(tripSlug, { ...status, lastFailureAt: new Date().toISOString() });
}

// The most recent attempt is a failure only if a failure timestamp exists and is newer
// than the last success -- a stale failure from before a later successful GET doesn't
// count as "currently failed".
export function isSyncFailed(status: SyncStatus): boolean {
  if (!status.lastFailureAt) return false;
  if (!status.lastSuccessAt) return true;
  return status.lastFailureAt > status.lastSuccessAt;
}

// A resolved checked-state GET isn't necessarily a genuine live sync: the
// service worker's NetworkFirst rule for this request (vite.config.ts)
// falls back to its own cache transparently, so a fetch can resolve
// "successfully" while the device is actually offline, serving stale
// cached data. isOnline is the caller's own read of navigator.onLine at
// the moment the GET resolved -- kept as a plain boolean parameter (not
// read in here) so this decision is a pure function, testable without any
// browser API or DOM. Returns whether it counted as a genuine success, so
// callers can gate their own "has this ever really synced" state on it.
export function recordSyncOutcome(tripSlug: string, isOnline: boolean): boolean {
  if (isOnline) {
    recordSyncSuccess(tripSlug);
    return true;
  }
  recordSyncFailure(tripSlug);
  return false;
}
