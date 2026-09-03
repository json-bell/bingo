import { describe, it, expect, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { fetchChecked, saveChecked } from "./checked";
import { readQueue } from "./checkedQueue";

// fetch() is intercepted at the network layer (msw), not mocked at the
// function level -- these assertions exercise real request construction
// and response parsing, per docs/backend-architecture.md §9.
describe("checked", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("fetchChecked", () => {
    it("requests the trip's checked state with the version query param and returns the cells map", async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get("/api/trips/:slug/checked", ({ params, request }) => {
          capturedUrl = new URL(request.url);
          expect(params.slug).toBe("europapark-2024");
          return HttpResponse.json({
            slug: "europapark-2024",
            version: 2,
            cells: { "cell-1": { checked: true, updatedAt: "2026-01-01T00:00:00.000Z" } },
            generatedAt: "2026-01-01T00:05:00.000Z",
          });
        })
      );

      const { cells, generatedAt } = await fetchChecked("europapark-2024", 2);

      expect(capturedUrl?.searchParams.get("version")).toBe("2");
      expect(cells).toEqual({ "cell-1": { checked: true, updatedAt: "2026-01-01T00:00:00.000Z" } });
      expect(generatedAt).toBe("2026-01-01T00:05:00.000Z");
    });

    it("throws on a non-2xx response", async () => {
      server.use(http.get("/api/trips/:slug/checked", () => HttpResponse.json({}, { status: 503 })));

      await expect(fetchChecked("europapark-2024", 2)).rejects.toThrow();
    });
  });

  describe("saveChecked", () => {
    it("enqueues the write and, once the drain succeeds, calls back with the server row", async () => {
      server.use(
        http.patch("/api/checked", async ({ request }) => {
          const body = (await request.json()) as { id: string; checked: boolean };
          return HttpResponse.json({
            id: body.id,
            checked: body.checked,
            updatedAt: "2026-01-01T00:01:00.000Z",
          });
        })
      );

      const received: Array<[string, unknown]> = [];
      await saveChecked("europapark-2024", "cell-1", true, "2026-01-01T00:00:00.000Z", false, (cellId, row) => {
        received.push([cellId, row]);
      });

      // saveChecked fires the drain without awaiting it (never blocks the
      // caller on the network) -- wait for the callback rather than a
      // fixed delay.
      await waitFor(() => expect(received).toHaveLength(1));

      expect(received).toEqual([["cell-1", { checked: true, updatedAt: "2026-01-01T00:01:00.000Z" }]]);
    });

    it("awaits the actual drain -- the queue is already empty by the time it resolves, not just eventually", async () => {
      // Regression guard: saveChecked previously fired the drain with
      // `void drain(...)` (fire-and-forget), so its own returned promise
      // resolved right after enqueueing, before the PATCH had even been
      // sent -- nothing then re-synced the "N updates queued" indicator
      // once the write actually completed, so it stayed stuck forever.
      server.use(
        http.patch("/api/checked", async ({ request }) => {
          const body = (await request.json()) as { id: string; checked: boolean };
          return HttpResponse.json({
            id: body.id,
            checked: body.checked,
            updatedAt: "2026-01-01T00:01:00.000Z",
          });
        })
      );

      await saveChecked("europapark-2024", "cell-1", true, "2026-01-01T00:00:00.000Z", false, () => {});

      expect(readQueue("europapark-2024")).toEqual({});
    });
  });
});
