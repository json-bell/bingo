import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fetchChecked, saveChecked } from "../lib/checked";
import type { CheckedCell, CheckedMap } from "../lib/checked";
import { drain, readQueue } from "../lib/checkedQueue";

// One provider per trip page (the page renders everyone's grid at once, not
// just "your own" -- see docs/plan.md), holding a flat map keyed by cellId.
// Cell ids are globally unique and the API is trip-scoped, so there's no
// need to key by person the way the phase 1 localStorage version did.

interface CheckedContextValue {
  isChecked: (cellId: string) => boolean;
  updateChecked: (cellId: string, value: boolean) => void;
  queuedCount: number;
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

  const syncQueuedCount = useCallback(() => {
    setQueuedCount(Object.keys(readQueue(tripSlug)).length);
  }, [tripSlug]);

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
    void drain(tripSlug, applyServerRow).then(syncQueuedCount);
  }, [tripSlug, applyServerRow, syncQueuedCount]);

  useEffect(() => {
    let cancelled = false;
    fetchChecked(tripSlug, version).then((serverCells) => {
      if (cancelled) return;
      // Reconciliation on load: seed from the last cached/live GET (the
      // service worker's NetworkFirst lane serves the cached response when
      // offline), then replay the persisted queue's pending values on top.
      // The queue is never the source of truth for anything except the
      // cells it's currently overriding.
      const queue = readQueue(tripSlug);
      const merged: CheckedMap = { ...serverCells };
      for (const write of Object.values(queue)) {
        merged[write.cellId] = { checked: write.checked, updatedAt: write.basisUpdatedAt };
      }
      setCells(merged);
      setQueuedCount(Object.keys(queue).length);
      runDrain(); // trigger #2: on mount, drain whatever's left over
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runDrain intentionally excluded: it would refire this effect on every render otherwise, and mount is the only trigger this effect owns (see triggers #1/#3 below).
  }, [tripSlug, version]);

  // Trigger #3: the browser regaining connectivity. Not the sole signal --
  // navigator.onLine reflects network-interface state, not "can we reach
  // the API" -- but it's a cheap, real opportunity to retry sooner than
  // waiting for the next mount.
  useEffect(() => {
    window.addEventListener("online", runDrain);
    return () => window.removeEventListener("online", runDrain);
  }, [runDrain]);

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
    void saveChecked(tripSlug, cellId, value, basisUpdatedAt, applyServerRow).then(
      syncQueuedCount
    );
    syncQueuedCount();
  }

  return (
    <CheckedContext.Provider value={{ isChecked, updateChecked, queuedCount }}>
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
