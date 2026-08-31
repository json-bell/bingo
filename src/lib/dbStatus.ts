// Diagnostic-only probe against the deliberately uncached DB health check
// (api/health/db.ts). Purely informational for the Sync Info modal, and
// kept separate from checked.ts/syncStatus.ts on purpose: this never
// influences the "Up to date" verdict or triggers any queue/retry
// behaviour -- it only reports whether the database is currently reachable
// and how slow it is (a Neon cold start shows up as a large latencyMs,
// which is expected, not an error).

export interface DbStatusResult {
  status: "ok";
  rows: number;
  latencyMs: number;
}

export async function fetchDbStatus(): Promise<DbStatusResult> {
  const response = await fetch("/api/health/db");
  if (!response.ok) {
    throw new Error(`DB health check failed: HTTP ${response.status}`);
  }
  return (await response.json()) as DbStatusResult;
}
