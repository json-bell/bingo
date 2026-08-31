// The phase 2 (REST API + offline queue) implementation of the checked-state
// seam described in docs/plan.md -- localStorage in phase 1, this API-backed
// version now. Callers (CheckedContext.tsx) never touch fetch or the queue
// directly, so this file is the one place that boundary lives.
//
// The return type widened from phase 1's bare Record<string, boolean>: every
// cell now carries updatedAt too, since that's the basis timestamp a PATCH
// needs for optimistic concurrency (docs/backend-architecture.md §4). The
// person parameter is gone -- cell ids are globally unique and the API is
// trip-scoped, so it carried no information; CheckedContext maps cell to
// person from the grid it already has.

import { drain, enqueue } from "./checkedQueue";
import type { CheckedCell } from "./checkedQueue";

export type { CheckedCell };
export type CheckedMap = Record<string, CheckedCell>;

interface CheckedResponseBody {
  slug: string;
  version: number;
  cells: CheckedMap;
  generatedAt: string; // ISO-8601, server response time -- see syncStatus.ts's isResponseFresh
}

export interface FetchedChecked {
  cells: CheckedMap;
  generatedAt: string;
}

// Throws on network failure or a non-2xx response -- the service worker's
// NetworkFirst lane (vite.config.ts) silently serves the cached response
// first when offline, so a throw here means "offline AND never loaded this
// trip before", not an ordinary offline visit. A resolved call can still be
// a stale cache hit, though -- generatedAt is what lets a caller tell the
// difference (see syncStatus.ts's isResponseFresh).
export async function fetchChecked(tripSlug: string, version: number): Promise<FetchedChecked> {
  const response = await fetch(
    `/api/trips/${encodeURIComponent(tripSlug)}/checked?version=${version}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load checked state: HTTP ${response.status}`);
  }
  const body = (await response.json()) as CheckedResponseBody;
  return { cells: body.cells, generatedAt: body.generatedAt };
}

// The only write entry point. Writes to the persisted queue synchronously,
// then attempts a drain. Never throws -- drain() already swallows network
// errors and non-2xx responses internally, so awaiting it here doesn't risk
// blocking the caller on a rejection, and callers that don't want to wait
// simply don't await this (see CheckedContext.tsx's updateChecked, which
// calls this without awaiting but does chain .then() to know when the
// drain this call triggered has actually finished -- that's why this
// awaits drain() rather than firing it with `void`: a caller has no other
// way to learn when a *specific* save's queue removal has happened, as
// opposed to some unrelated later drain).
export async function saveChecked(
  tripSlug: string,
  cellId: string,
  value: boolean,
  basisUpdatedAt: string,
  onServerRow: (cellId: string, row: CheckedCell) => void
): Promise<void> {
  enqueue(tripSlug, {
    cellId,
    checked: value,
    basisUpdatedAt,
    enqueuedAt: new Date().toISOString(),
  });
  await drain(tripSlug, onServerRow);
}
