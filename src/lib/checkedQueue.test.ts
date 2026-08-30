import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { drain, enqueue, readQueue, removeQueuedWrite } from "./checkedQueue";

describe("checkedQueue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("drains multiple queued cells and converges to the correct final value for each", async () => {
    const patchedIds: string[] = [];
    server.use(
      http.patch("/api/checked", async ({ request }) => {
        const body = (await request.json()) as { id: string; checked: boolean };
        patchedIds.push(body.id);
        return HttpResponse.json({
          id: body.id,
          checked: body.checked,
          updatedAt: new Date().toISOString(),
        });
      })
    );

    enqueue("trip", { cellId: "a", checked: true, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });
    enqueue("trip", { cellId: "b", checked: false, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });
    enqueue("trip", { cellId: "c", checked: true, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });

    const applied: Record<string, boolean> = {};
    await drain("trip", (cellId, row) => {
      applied[cellId] = row.checked;
    });

    expect(patchedIds.sort()).toEqual(["a", "b", "c"]);
    expect(applied).toEqual({ a: true, b: false, c: true });
    expect(readQueue("trip")).toEqual({});
  });

  it("does not drop a re-toggle that happens while the first write is still in flight", async () => {
    let resolvePatch: (() => void) | undefined;
    server.use(
      http.patch("/api/checked", async ({ request }) => {
        const body = (await request.json()) as { id: string; checked: boolean };
        await new Promise<void>((resolve) => {
          resolvePatch = resolve;
        });
        return HttpResponse.json({ id: body.id, checked: body.checked, updatedAt: "2026-01-01T00:01:00.000Z" });
      })
    );

    enqueue("trip", { cellId: "a", checked: true, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });
    const drainPromise = drain("trip", () => {});

    // Wait for the PATCH to actually be in flight, then re-toggle the same
    // cell before it resolves.
    await vi.waitFor(() => {
      if (!resolvePatch) throw new Error("PATCH not in flight yet");
    });
    enqueue("trip", { cellId: "a", checked: false, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "2" });

    resolvePatch?.();
    await drainPromise;

    // The in-flight write's response was for enqueuedAt "1", but the queue
    // now holds "2" -- removeIfUnchanged must not delete it, or the
    // re-toggle would be silently lost.
    expect(readQueue("trip")).toEqual({
      a: { cellId: "a", checked: false, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "2" },
    });
  });

  it("removeQueuedWrite deletes only the targeted cell, unconditionally", () => {
    enqueue("trip", { cellId: "a", checked: true, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });
    enqueue("trip", { cellId: "b", checked: false, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });

    removeQueuedWrite("trip", "a");

    expect(readQueue("trip")).toEqual({
      b: { cellId: "b", checked: false, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" },
    });
  });

  it("removeQueuedWrite is a no-op for a cell id that isn't queued", () => {
    enqueue("trip", { cellId: "a", checked: true, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" });

    removeQueuedWrite("trip", "not-queued");

    expect(readQueue("trip")).toEqual({
      a: { cellId: "a", checked: true, basisUpdatedAt: "2026-01-01T00:00:00.000Z", enqueuedAt: "1" },
    });
  });
});
