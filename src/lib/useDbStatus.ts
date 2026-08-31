import { useEffect, useState } from "react";
import { fetchDbStatus } from "./dbStatus";

export type DbStatus = { state: "pending" } | { state: "ok"; latencyMs: number } | { state: "error" };

// Fires the uncached DB health probe exactly once, on mount -- no retry, no
// polling, and no interaction with CheckedContext/syncStatus.ts at all.
// Purely a display-layer signal for the Sync Info modal (see dbStatus.ts).
export function useDbStatus(): DbStatus {
  const [status, setStatus] = useState<DbStatus>({ state: "pending" });

  useEffect(() => {
    let cancelled = false;
    fetchDbStatus()
      .then((result) => {
        if (!cancelled) setStatus({ state: "ok", latencyMs: result.latencyMs });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
