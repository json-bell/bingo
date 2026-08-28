import { count } from "drizzle-orm";
import { db } from "../../db/client.js";
import { checked } from "../../db/schema.js";
import { apiError, json } from "../lib/responses.js";

// A real SELECT count(*) against the checked table, not SELECT 1 -- this
// proves connectivity *and* that migrations have actually been applied to
// whatever database DATABASE_URL points at. SELECT 1 would pass against an
// empty, never-migrated database, which is exactly the failure mode this
// route exists to catch on a first deploy. See docs/backend-architecture.md
// §4. latencyMs is worth having: a Neon cold start shows up here as a
// multi-second number, which is normal and not a bug.
export async function GET(): Promise<Response> {
  const start = Date.now();
  try {
    const [{ rows }] = await db.select({ rows: count() }).from(checked);
    return json({ status: "ok", rows, latencyMs: Date.now() - start });
  } catch (error) {
    console.error("GET /api/health/db failed:", error);
    return apiError(503, "DB_UNAVAILABLE", "Could not reach the database.");
  }
}
