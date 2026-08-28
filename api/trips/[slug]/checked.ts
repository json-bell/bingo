import { and, eq } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { checked } from "../../../db/schema.js";
import { apiError, json } from "../../lib/responses.js";

// Plain (non-Next.js) Vercel Functions only receive (request: Request) --
// no params/context object for dynamic [slug] segments the way Next.js App
// Router route handlers get { params } (confirmed against Vercel's own
// Functions API reference). So the slug has to be parsed from the URL path
// itself, not injected by the platform.
const PATH_PATTERN = /^\/api\/trips\/([^/]+)\/checked$/;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(PATH_PATTERN);
  const slug = match?.[1];
  if (!slug) {
    return apiError(400, "BAD_REQUEST", "Could not parse a trip slug from the URL.");
  }

  const versionParam = url.searchParams.get("version");
  const version = versionParam ? Number(versionParam) : NaN;
  if (!Number.isInteger(version) || version <= 0) {
    return apiError(400, "BAD_REQUEST", "version must be a positive integer.");
  }

  try {
    const rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, slug), eq(checked.gridVersion, version)));

    // 200 even for zero rows -- an unknown slug and a not-yet-seeded trip
    // are indistinguishable at the DB level, and the client only ever
    // builds this URL from a slug loadTrip() already resolved. See
    // docs/backend-architecture.md §4.
    const cells: Record<string, { checked: boolean; updatedAt: string }> = {};
    for (const row of rows) {
      cells[row.cellId] = { checked: row.checked, updatedAt: row.updatedAt.toISOString() };
    }

    return json({ slug, version, cells });
  } catch (error) {
    console.error(`GET /api/trips/${slug}/checked failed:`, error);
    return apiError(503, "DB_UNAVAILABLE", "Could not reach the database.");
  }
}
