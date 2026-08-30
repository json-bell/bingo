import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { fetchChecked, saveChecked } from "../lib/checked";
import type { CheckedCell, CheckedMap } from "../lib/checked";
import { drain, readQueue } from "../lib/checkedQueue";
import { isSyncFailed, readSyncStatus, recordSyncFailure, recordSyncSuccess } from "../lib/syncStatus";

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
  const [isSending, setIsSending] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [syncFailed, setSyncFailed] = useState(false);
  // Set once a GET has ever succeeded this page-load; gates the online-event
  // retry below so a healthy load doesn't start re-fetching on every
  // reconnect -- only a load that never succeeded gets retried.
  const hasSyncedRef = useRef(false);

  const syncQueuedCount = useCallback(() => {
    setQueuedCount(Object.keys(readQueue(tripSlug)).length);
  }, [tripSlug]);

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
    { merged: CheckedMap; queueSize: number } | null
  > => {
    try {
      const serverCells = await fetchChecked(tripSlug, version);
      hasSyncedRef.current = true;
      recordSyncSuccess(tripSlug);
      const queue = readQueue(tripSlug);
      const merged: CheckedMap = { ...serverCells };
      for (const write of Object.values(queue)) {
        merged[write.cellId] = { checked: write.checked, updatedAt: write.basisUpdatedAt };
      }
      return { merged, queueSize: Object.keys(queue).length };
    } catch {
      recordSyncFailure(tripSlug);
      return null;
    } finally {
      refreshSyncStatus();
    }
  }, [tripSlug, version, refreshSyncStatus]);

  const applyLoadResult = useCallback((result: { merged: CheckedMap; queueSize: number } | null) => {
    if (!result) return;
    setCells(result.merged);
    setQueuedCount(result.queueSize);
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
    const basisUpdatedAt = cells[cellId]?.updatedAt ?? new Date(0).toISOString();
    setCells((current) => ({
      ...current,
      [cellId]: { checked: value, updatedAt: basisUpdatedAt },
    }));
    // Trigger #1: attempt the whole queue immediately after enqueueing --
    // if it fails, everything just stays queued for triggers #2/#3.
    void withSendingIndicator(
      saveChecked(tripSlug, cellId, value, basisUpdatedAt, applyServerRow).then(syncQueuedCount)
    );
    syncQueuedCount();
  }

  return (
    <CheckedContext.Provider
      value={{ isChecked, updateChecked, queuedCount, isSending, lastSyncedAt, syncFailed }}
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
