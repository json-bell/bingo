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

// Comfortably above vite.config.ts's networkTimeoutSeconds (5s) -- a
// response actually served fresh from the network never gets close to
// this. A genuinely stale cache hit, on the other hand, is generated as
// long ago as the last real gap in connectivity (minutes/hours/days), not
// merely a few seconds -- so the exact cutoff isn't sensitive, it just
// needs to sit safely above real network latency and below "obviously old".
const STALE_THRESHOLD_MS = 30_000;

// Whether a checked-state GET response is recent enough to have plausibly
// come from a live network request, vs. a stale hit served by the service
// worker's NetworkFirst cache fallback (vite.config.ts) -- indistinguishable
// from a live response at the fetch layer itself. generatedAt is the
// response body's own server-side timestamp (api/trips/[slug]/checked.ts).
export function isResponseFresh(generatedAt: string): boolean {
  return Date.now() - new Date(generatedAt).getTime() < STALE_THRESHOLD_MS;
}

// A resolved checked-state GET isn't necessarily a genuine live sync: it
// can be a stale cache hit (see isResponseFresh above) served while
// offline, or while online but slower than the network timeout (e.g. a
// Neon cold start). isFresh is the caller's own freshness verdict (kept as
// a plain boolean parameter, not computed in here) so this decision stays a
// pure function, testable without any browser API or DOM. Returns whether
// it counted as a genuine success, so callers can gate their own "has this
// ever really synced" state on it.
export function recordSyncOutcome(tripSlug: string, isFresh: boolean): boolean {
  if (isFresh) {
    recordSyncSuccess(tripSlug);
    return true;
  }
  recordSyncFailure(tripSlug);
  return false;
}
