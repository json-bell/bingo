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
}

// Throws on network failure or a non-2xx response -- the service worker's
// NetworkFirst lane (vite.config.ts) silently serves the cached response
// first when offline, so a throw here means "offline AND never loaded this
// trip before", not an ordinary offline visit.
export async function fetchChecked(tripSlug: string, version: number): Promise<CheckedMap> {
  const response = await fetch(
    `/api/trips/${encodeURIComponent(tripSlug)}/checked?version=${version}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load checked state: HTTP ${response.status}`);
  }
  const body = (await response.json()) as CheckedResponseBody;
  return body.cells;
}

// The only write entry point. Writes to the persisted queue synchronously,
// then fires a drain. Never throws -- a failed drain just leaves work
// queued for the next trigger (see checkedQueue.ts).
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
  void drain(tripSlug, onServerRow);
}
