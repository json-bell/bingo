// The offline write queue behind saveChecked() in checked.ts. There is
// exactly one write path -- online or offline, every save enqueues here
// first and then a drain is attempted -- so the 409/404/503 handling below
// is written once, not once for "online" and again for "offline". See
// docs/backend-architecture.md §9.

export interface CheckedCell {
  checked: boolean;
  updatedAt: string; // ISO-8601, server-authoritative
}

export interface QueuedWrite {
  cellId: string;
  checked: boolean;
  basisUpdatedAt: string; // what the client knew when the edit was made
  enqueuedAt: string; // identity token -- see removeIfUnchanged below
}

// Keyed by cellId, NOT an append log. Toggling the same cell twice while
// offline replaces the pending entry rather than queueing two replays --
// only the latest value per cell can possibly matter.
export type CheckedQueue = Record<string, QueuedWrite>;

const QUEUE_KEY_PREFIX = "bingo:checked:queue";

function queueKey(tripSlug: string): string {
  return `${QUEUE_KEY_PREFIX}:${tripSlug}`;
}

// Any read-modify-write here must stay synchronous, with no `await` between
// the read and the write -- otherwise a second drain could read, modify,
// and write in the gap, and this write would be lost.
export function readQueue(tripSlug: string): CheckedQueue {
  const raw = localStorage.getItem(queueKey(tripSlug));
  return raw ? (JSON.parse(raw) as CheckedQueue) : {};
}

function writeQueue(tripSlug: string, queue: CheckedQueue): void {
  localStorage.setItem(queueKey(tripSlug), JSON.stringify(queue));
}

export function enqueue(tripSlug: string, write: QueuedWrite): CheckedQueue {
  const queue = readQueue(tripSlug);
  queue[write.cellId] = write;
  writeQueue(tripSlug, queue);
  return queue;
}

// The in-flight re-toggle: if the user toggles a cell again while its PATCH
// is airborne, the queue entry for that cellId now holds a newer value.
// Blindly deleting on a drain response would silently drop it -- only
// delete when the entry is still the one that was actually sent.
export function removeIfUnchanged(tripSlug: string, write: QueuedWrite): CheckedQueue {
  const queue = readQueue(tripSlug);
  if (queue[write.cellId]?.enqueuedAt === write.enqueuedAt) {
    delete queue[write.cellId];
    writeQueue(tripSlug, queue);
  }
  return queue;
}

// Guards against triggers 1 (enqueue), 2 (mount), and 3 (online event)
// firing at once and double-sending -- see checked.ts/CheckedContext.tsx.
const drainingTrips = new Set<string>();

interface PatchResponseBody {
  id?: string;
  checked?: boolean;
  updatedAt?: string;
  current?: { id: string; checked: boolean; updatedAt: string };
}

// Entries are PATCHed sequentially, not in parallel -- the queue is at most
// a handful of entries, sequential keeps conflict handling linear, and it
// avoids a burst of parallel requests at a server that may have just
// cold-started.
export async function drain(
  tripSlug: string,
  onServerRow: (cellId: string, row: CheckedCell) => void
): Promise<void> {
  if (drainingTrips.has(tripSlug)) return;
  drainingTrips.add(tripSlug);

  try {
    for (const write of Object.values(readQueue(tripSlug))) {
      let response: Response;
      try {
        response = await fetch("/api/checked", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: write.cellId,
            checked: write.checked,
            updatedAt: write.basisUpdatedAt,
          }),
        });
      } catch {
        // Network error -- no point walking the remaining entries against a
        // server that's currently unreachable. Leave everything queued.
        break;
      }

      if (response.status === 200) {
        const row = (await response.json()) as PatchResponseBody;
        if (row.id && row.updatedAt !== undefined && row.checked !== undefined) {
          onServerRow(row.id, { checked: row.checked, updatedAt: row.updatedAt });
        }
        removeIfUnchanged(tripSlug, write);
      } else if (response.status === 409) {
        // The server is right. Apply the current row -- the local edit is
        // discarded. This is exactly why the 409 body carries the row.
        const body = (await response.json()) as PatchResponseBody;
        if (body.current) {
          onServerRow(body.current.id, {
            checked: body.current.checked,
            updatedAt: body.current.updatedAt,
          });
        }
        removeIfUnchanged(tripSlug, write);
      } else if (response.status === 400 || response.status === 404) {
        // Unretryable. A 404 specifically means the grid wasn't seeded;
        // leaving it queued would retry forever. The tile reverts to
        // server truth on the next GET.
        console.warn(`Dropping queued write for cell ${write.cellId}: HTTP ${response.status}`);
        removeIfUnchanged(tripSlug, write);
      } else {
        // 500/503/anything else -- abort the rest of the drain, leave
        // everything queued for the next trigger.
        break;
      }
    }
  } finally {
    drainingTrips.delete(tripSlug);
  }
}
