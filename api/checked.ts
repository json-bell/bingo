import { and, eq, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { checked } from "../db/schema.js";
import { apiError, json } from "./lib/responses.js";

interface PatchBody {
  id: string;
  checked: boolean;
  updatedAt: string;
}

function parseBody(raw: unknown): PatchBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.id !== "string" || body.id.length === 0) return null;
  if (typeof body.checked !== "boolean") return null;
  if (typeof body.updatedAt !== "string") return null;
  const basis = new Date(body.updatedAt);
  if (Number.isNaN(basis.getTime())) return null;
  return { id: body.id, checked: body.checked, updatedAt: body.updatedAt };
}

// Not nested under /trips/:slug -- cell_id is globally unique, so a slug in
// the URL would carry no information the body doesn't, and would just be a
// second source of truth the server has to validate against the row for no
// gain. See docs/backend-architecture.md §4.
export async function PATCH(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Body must be valid JSON.");
  }

  const body = parseBody(raw);
  if (!body) {
    return apiError(
      400,
      "BAD_REQUEST",
      "Body must be { id: string, checked: boolean, updatedAt: ISO-8601 string }."
    );
  }

  try {
    // The client's basis timestamp -- the value it last knew for this row,
    // not "now". <=, not <, so re-sending an identical write with an
    // unchanged basis succeeds as a no-op rather than 409-ing: the offline
    // queue drains at-least-once by design, and a duplicate delivery must
    // not look like a conflict. See docs/backend-architecture.md §4.
    const basis = new Date(body.updatedAt);
    const [updatedRow] = await db
      .update(checked)
      .set({ checked: body.checked, updatedAt: new Date() })
      .where(and(eq(checked.cellId, body.id), lte(checked.updatedAt, basis)))
      .returning();

    if (updatedRow) {
      return json({ id: updatedRow.cellId, checked: updatedRow.checked, updatedAt: updatedRow.updatedAt.toISOString() });
    }

    // No row updated: either the cell doesn't exist, or the guard failed.
    // Re-SELECT to tell which -- absent is 404, present (but stale) is 409.
    const [currentRow] = await db.select().from(checked).where(eq(checked.cellId, body.id));

    if (!currentRow) {
      return apiError(404, "CELL_NOT_FOUND", `No checked row for cell id ${body.id}.`);
    }

    return apiError(409, "STALE_WRITE", `Row was modified at ${currentRow.updatedAt.toISOString()}.`, {
      current: {
        id: currentRow.cellId,
        checked: currentRow.checked,
        updatedAt: currentRow.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/checked failed:", error);
    return apiError(503, "DB_UNAVAILABLE", "Could not reach the database.");
  }
}
