import { describe, expect, it } from "vitest";
import { db } from "../db/client.js";
import { checked } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { PATCH } from "./checked.js";

async function seedRow(overrides: Partial<typeof checked.$inferInsert> = {}) {
  const cellId = crypto.randomUUID();
  const [row] = await db
    .insert(checked)
    .values({
      cellId,
      checked: false,
      tripSlug: "test-trip",
      gridVersion: 1,
      person: "Alex",
      ...overrides,
    })
    .returning();
  return row;
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/checked", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/checked", () => {
  it("200: updates the row and advances updatedAt", async () => {
    const row = await seedRow();

    const response = await PATCH(
      patchRequest({ id: row.cellId, checked: true, updatedAt: row.updatedAt.toISOString() })
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as { id: string; checked: boolean; updatedAt: string };
    expect(body.id).toBe(row.cellId);
    expect(body.checked).toBe(true);
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(row.updatedAt.getTime());
  });

  it("409: rejects a stale basis timestamp and returns the current server row", async () => {
    const row = await seedRow();
    // Advance the row's real updated_at past the basis we're about to send.
    await db
      .update(checked)
      .set({ checked: true, updatedAt: new Date(Date.now() + 1000) })
      .where(eq(checked.cellId, row.cellId));

    const response = await PATCH(
      patchRequest({ id: row.cellId, checked: false, updatedAt: row.updatedAt.toISOString() })
    );
    expect(response.status).toBe(409);

    const body = (await response.json()) as { current: { id: string; checked: boolean } };
    expect(body.current.id).toBe(row.cellId);
    expect(body.current.checked).toBe(true);
  });

  it("404: unknown cell id", async () => {
    const response = await PATCH(
      patchRequest({ id: crypto.randomUUID(), checked: true, updatedAt: new Date().toISOString() })
    );
    expect(response.status).toBe(404);
  });

  it("400: malformed body", async () => {
    const missingId = await PATCH(patchRequest({ checked: true, updatedAt: new Date().toISOString() }));
    expect(missingId.status).toBe(400);

    const nonBooleanChecked = await PATCH(
      patchRequest({ id: "x", checked: "yes", updatedAt: new Date().toISOString() })
    );
    expect(nonBooleanChecked.status).toBe(400);

    const badTimestamp = await PATCH(patchRequest({ id: "x", checked: true, updatedAt: "not-a-date" }));
    expect(badTimestamp.status).toBe(400);
  });

  it("retrying the same write after it already succeeded gets a 409 whose current value already matches what was wanted", async () => {
    // updated_at advances to NOW() on every successful write (see the SQL
    // in docs/backend-architecture.md §4), so a genuine retry of the same
    // {id, checked, updatedAt} payload *after* the first one already
    // committed legitimately fails the <= guard -- the row really did
    // move. This isn't a hole in the design: the offline queue drains
    // at-least-once and can lose a response before a retry, and this is
    // exactly that case. The retry correctly 409s, but its `current` body
    // already holds the value the client wanted, so reconciling onto it
    // (per §9's drain behaviour) loses nothing even though the response
    // wasn't a 200.
    const row = await seedRow();
    const payload = { id: row.cellId, checked: true, updatedAt: row.updatedAt.toISOString() };

    const first = await PATCH(patchRequest(payload));
    expect(first.status).toBe(200);

    const retry = await PATCH(patchRequest(payload));
    expect(retry.status).toBe(409);

    const body = (await retry.json()) as { current: { checked: boolean } };
    expect(body.current.checked).toBe(payload.checked);
  });

  it("the <= guard lets an uncontested write through when the basis exactly matches the row's current state", async () => {
    // This is what <= (rather than strict <) actually guarantees: the
    // normal, uncontested case -- nothing else touched the row between the
    // client's read and its write -- succeeds. Equality is the everyday
    // case, not an edge case: a strict < guard would reject every
    // uncontested first write, since the row's updated_at always exactly
    // equals the client's basis when nothing raced it.
    const row = await seedRow();
    const response = await PATCH(
      patchRequest({ id: row.cellId, checked: true, updatedAt: row.updatedAt.toISOString() })
    );
    expect(response.status).toBe(200);
  });
});
