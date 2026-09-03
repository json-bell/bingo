import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { fetchChecked, saveChecked } from "../lib/checked";
import type { CheckedCell, CheckedMap } from "../lib/checked";
import { drain, readQueue, removeQueuedWrite } from "../lib/checkedQueue";
import type { QueuedWrite } from "../lib/checkedQueue";
import {
  isResponseFresh,
  isSyncFailed,
  readSyncStatus,
  recordSyncFailure,
  recordSyncOutcome,
} from "../lib/syncStatus";

// One provider per trip page (the page renders everyone's grid at once, not
// just "your own" -- see docs/plan.md), holding a flat map keyed by cellId.
// Cell ids are globally unique and the API is trip-scoped, so there's no
// need to key by person the way the phase 1 localStorage version did.

interface CheckedContextValue {
  isChecked: (cellId: string) => boolean;
  updateChecked: (cellId: string, value: boolean) => void;
  queuedCount: number;
  // True while a drain this context initiated is still in flight -- i.e.
  // "at least one queued write's PATCH hasn't settled yet", not just "the
  // queue is non-empty". QueueStatus derives its "updating" vs "queued,
  // waiting to sync" label from this. Tracked by wrapping each of the two
  // drain-triggering call sites (runDrain, updateChecked's saveChecked
  // call) rather than reading checkedQueue.ts's internal draining state
  // directly -- simpler, at the cost of a rare cosmetic-only edge case: if
  // two triggers overlap, the second call's wrapper can flip this back to
  // false slightly before the first call's still-running drain (silently
  // no-op'd by checkedQueue.ts's own concurrency guard) actually finishes.
  isSending: boolean;
  // The full pending queue, for the Sync Info modal's per-entry list --
  // queuedCount above stays a plain number for QueueStatus, which never
  // needed more than a count.
  queuedWrites: QueuedWrite[];
  // Unconditional removal (see checkedQueue.ts's removeQueuedWrite) -- the
  // modal only shows this control while isSending is false, since there's
  // no way to cancel a request that's already in flight (drain() has no
  // AbortController), only to stop one from ever being sent.
  removeQueued: (cellId: string) => void;
  // The checked-state GET side (separate from the PATCH queue above): when the
  // last successful load happened, and whether the most recent attempt since
  // then failed. See src/lib/syncStatus.ts.
  lastSyncedAt?: string;
  syncFailed: boolean;
}

const CheckedContext = createContext<CheckedContextValue | null>(null);

interface CheckedProviderProps {
  tripSlug: string;
  version: number;
  children: ReactNode;
}

export function CheckedProvider({ tripSlug, version, children }: CheckedProviderProps) {
  const [cells, setCells] = useState<CheckedMap>({});
  const [queuedCount, setQueuedCount] = useState(0);
  const [queuedWrites, setQueuedWrites] = useState<QueuedWrite[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [syncFailed, setSyncFailed] = useState(false);
  // Set once a GET has ever succeeded this page-load; gates the online-event
  // retry below so a healthy load doesn't start re-fetching on every
  // reconnect -- only a load that never succeeded gets retried.
  const hasSyncedRef = useRef(false);

  const syncQueuedCount = useCallback(() => {
    const writes = Object.values(readQueue(tripSlug));
    setQueuedCount(writes.length);
    setQueuedWrites(writes);
  }, [tripSlug]);

  // Dropping the queued write only stops it from being sent -- the cell's
  // displayed state was already flipped optimistically by updateChecked
  // before this write ever reached the queue, so without this it would
  // keep showing that unsent value indefinitely (until an unrelated GET
  // happened to overwrite it). Revert to whatever the write's own
  // previousChecked/basisUpdatedAt say the cell was before this edit.
  const removeQueued = useCallback(
    (cellId: string) => {
      const write = readQueue(tripSlug)[cellId];
      removeQueuedWrite(tripSlug, cellId);
      if (write) {
        setCells((current) => ({
          ...current,
          [cellId]: { checked: write.previousChecked, updatedAt: write.basisUpdatedAt },
        }));
      }
      syncQueuedCount();
    },
    [tripSlug, syncQueuedCount]
  );

  const refreshSyncStatus = useCallback(() => {
    const status = readSyncStatus(tripSlug);
    setLastSyncedAt(status.lastSuccessAt);
    setSyncFailed(isSyncFailed(status));
  }, [tripSlug]);

  const withSendingIndicator = useCallback(async (work: Promise<void>) => {
    setIsSending(true);
    try {
      await work;
    } finally {
      setIsSending(false);
    }
  }, []);

  // Always the functional/updater form -- drain responses land close
  // together and out of order, and a closed-over `cells` would be stale.
  const applyServerRow = useCallback(
    (cellId: string, row: CheckedCell) => {
      setCells((current) => ({ ...current, [cellId]: row }));
      syncQueuedCount();
    },
    [syncQueuedCount]
  );

  const runDrain = useCallback(() => {
    void withSendingIndicator(drain(tripSlug, applyServerRow).then(syncQueuedCount));
  }, [tripSlug, applyServerRow, syncQueuedCount, withSendingIndicator]);

  // Shared by the mount effect and the online-event retry below: fetch,
  // record success/failure for the "last synced" status, and -- on success
  // only -- reconcile with the persisted queue (seed from the last cached/
  // live GET, then replay the queue's pending values on top; the queue is
  // never the source of truth for anything except the cells it's currently
  // overriding). Returns the merge result rather than setting state
  // directly, so each caller can apply it only if it's still relevant (the
  // mount effect checks `cancelled`).
  const loadAndMerge = useCallback(async (): Promise<
    { merged: CheckedMap; writes: QueuedWrite[] } | null
  > => {
    try {
      const { cells: serverCells, generatedAt } = await fetchChecked(tripSlug, version);
      const writes = Object.values(readQueue(tripSlug));
      const merged: CheckedMap = { ...serverCells };
      for (const write of writes) {
        merged[write.cellId] = { checked: write.checked, updatedAt: write.basisUpdatedAt };
      }
      // The service worker's NetworkFirst rule for this GET (vite.config.ts)
      // falls back to its own cache transparently -- a resolved fetch here
      // can be a genuinely live response OR a stale cache hit served while
      // offline (or while online but slower than the network timeout, e.g.
      // a Neon cold start), and there's no way to tell which from the
      // Response alone. generatedAt (the response body's own server
      // timestamp) is what actually distinguishes them; isResponseFresh /
      // recordSyncOutcome (syncStatus.ts) is the pure decision ("recent
      // enough -> success, stale -> failure, don't claim a fresh sync from
      // a possibly-stale cache read"), kept out of this component so it's
      // testable without mocking a browser API. hasSyncedRef only flips on
      // a genuinely fresh success, so the online-event retry below still
      // runs once real connectivity returns, to record an actual fresh sync.
      if (recordSyncOutcome(tripSlug, isResponseFresh(generatedAt))) {
        hasSyncedRef.current = true;
      }
      return { merged, writes };
    } catch {
      recordSyncFailure(tripSlug);
      return null;
    } finally {
      refreshSyncStatus();
    }
  }, [tripSlug, version, refreshSyncStatus]);

  const applyLoadResult = useCallback((result: { merged: CheckedMap; writes: QueuedWrite[] } | null) => {
    if (!result) return;
    setCells(result.merged);
    setQueuedCount(result.writes.length);
    setQueuedWrites(result.writes);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAndMerge().then((result) => {
      if (cancelled) return;
      applyLoadResult(result);
      runDrain(); // trigger #2: on mount, drain whatever's left over regardless of GET outcome
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAndMerge/applyLoadResult/runDrain intentionally excluded: they'd refire this effect on every render otherwise, and mount is the only trigger this effect owns (see triggers #1/#3 below).
  }, [tripSlug, version]);

  // Trigger #3: the browser regaining connectivity. Not the sole signal --
  // navigator.onLine reflects network-interface state, not "can we reach
  // the API" -- but it's a cheap, real opportunity to retry sooner than
  // waiting for the next mount. If the GET has never succeeded this
  // page-load, retry it here too (then reconcile + drain); once it has
  // succeeded, only the PATCH queue gets retried on further reconnects --
  // this isn't a periodic refresh, just closing the "failed and never
  // retried" gap for the one-shot initial load.
  useEffect(() => {
    const handleOnline = () => {
      if (hasSyncedRef.current) {
        runDrain();
        return;
      }
      void loadAndMerge().then((result) => {
        applyLoadResult(result);
        runDrain();
      });
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadAndMerge, applyLoadResult, runDrain]);

  function isChecked(cellId: string): boolean {
    return Boolean(cells[cellId]?.checked);
  }

  function updateChecked(cellId: string, value: boolean): void {
    const previousChecked = cells[cellId]?.checked ?? false;
    const basisUpdatedAt = cells[cellId]?.updatedAt ?? new Date(0).toISOString();
    setCells((current) => ({
      ...current,
      [cellId]: { checked: value, updatedAt: basisUpdatedAt },
    }));
    // Trigger #1: attempt the whole queue immediately after enqueueing --
    // if it fails, everything just stays queued for triggers #2/#3.
    void withSendingIndicator(
      saveChecked(tripSlug, cellId, value, basisUpdatedAt, previousChecked, applyServerRow).then(
        syncQueuedCount
      )
    );
    syncQueuedCount();
  }

  return (
    <CheckedContext.Provider
      value={{
        isChecked,
        updateChecked,
        queuedCount,
        queuedWrites,
        removeQueued,
        isSending,
        lastSyncedAt,
        syncFailed,
      }}
    >
      {children}
    </CheckedContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- standard Context+hook pairing
export function useChecked(): CheckedContextValue {
  const context = useContext(CheckedContext);
  if (!context) {
    throw new Error("useChecked must be used within a CheckedProvider");
  }
  return context;
}
