import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../lib/msw/server";
import { getGrids } from "../../data/getGrids";
import type { BingoItem, Difficulty, LoadedTrip } from "../../types/trip";
import type { CheckedCell } from "../lib/checked";

// TripPage for real, no mocked context -- same "go through the seam, not
// around it" philosophy as TripPage.test.tsx. The one seam this file *does*
// mock is loadTrip: config/trips.json's currentVersion is a static import
// baked in at module-load time, so there's no way to render two different
// versions of "the same trip" through the real seam within one test run
// without either editing that committed file mid-test (unreliable -- the
// import is already cached by the time any test body runs) or mocking the
// function that reads it. Everything downstream -- Tile, the dialog,
// CheckedContext, checked.ts, checkedQueue.ts, and the real PATCH/GET
// requests (intercepted at the network layer via msw, not mocked) -- runs
// for real. Kept in its own file (not added to TripPage.test.tsx) so this
// vi.mock doesn't affect that file's real-loadTrip tests.
vi.mock("../lib/trips", () => ({
  loadTrip: vi.fn(),
  listSlugs: vi.fn(),
}));
import { loadTrip } from "../lib/trips";
import { TripPage } from "./TripPage";

function makeEvents(difficulty: Difficulty, count: number, prefix: string): BingoItem[] {
  return Array.from({ length: count }, (_, i) => ({
    difficulty,
    summary: `${prefix}-${i}`,
    description: `Filler event ${prefix}-${i}`,
  }));
}
function buildFixtureRows(): BingoItem[] {
  return [...makeEvents("e", 8, "easy"), ...makeEvents("m", 8, "med"), ...makeEvents("h", 8, "hard")];
}

const characters = ["Alice", "Bob"];
const people = ["Solo"];

function buildLoadedTrip(version: number): LoadedTrip {
  const grids = getGrids({ data: { rows: buildFixtureRows() }, characters, people });
  return { grids, people, title: "Fixture Trip", version };
}

function findButtonByText(container: HTMLElement, selector: string, text: string): HTMLElement {
  const match = Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
    (button) => button.textContent?.trim() === text
  );
  if (!match) throw new Error(`button "${text}" not found`);
  return match;
}

describe("TripPage: two grid versions of the same trip stay isolated", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(loadTrip).mockReset();
  });
  afterEach(() => {
    server.resetHandlers();
  });

  it("persists a check across a reload of the same version, and starts a different version unchecked", async () => {
    const tripV1 = buildLoadedTrip(1);
    const tripV2 = buildLoadedTrip(2);

    // Mirrors the real backend's contract exactly (api/checked.ts,
    // api/trips/[slug]/checked.ts): PATCH is keyed only by the globally
    // unique cellId (no slug/version at all), GET is scoped to whichever
    // (tripSlug, version) the query asks for. cellIdsByVersion is what lets
    // this in-memory store answer that scoping the same way the real
    // `WHERE tripSlug = ... AND gridVersion = ...` query would, rather than
    // just returning "everything ever patched" and having the test pass
    // for the wrong reason (version 1 and version 2's cellIds never
    // collide anyway, since getGrids mints fresh crypto.randomUUID()s
    // per call -- filtering by version here is what actually exercises
    // that a GET for version 2 can't see version 1's rows).
    const checkedStore = new Map<string, CheckedCell>();
    const cellIdsByVersion: Record<number, Set<string>> = {
      1: new Set(tripV1.grids.flatMap((grid) => grid.flat().map((cell) => cell.id))),
      2: new Set(tripV2.grids.flatMap((grid) => grid.flat().map((cell) => cell.id))),
    };
    server.use(
      http.get("/api/trips/:slug/checked", ({ params, request }) => {
        const url = new URL(request.url);
        const version = Number(url.searchParams.get("version"));
        const ids = cellIdsByVersion[version] ?? new Set<string>();
        const cells: Record<string, CheckedCell> = {};
        for (const [id, row] of checkedStore) {
          if (ids.has(id)) cells[id] = row;
        }
        return HttpResponse.json({
          slug: params.slug,
          version,
          cells,
          generatedAt: new Date().toISOString(),
        });
      }),
      http.patch("/api/checked", async ({ request }) => {
        const body = (await request.json()) as { id: string; checked: boolean };
        const row: CheckedCell = { checked: body.checked, updatedAt: new Date().toISOString() };
        checkedStore.set(body.id, row);
        return HttpResponse.json({ id: body.id, checked: row.checked, updatedAt: row.updatedAt });
      })
    );

    // --- 1. Load version 1, tick a box, Save. ---
    vi.mocked(loadTrip).mockResolvedValueOnce(tripV1);
    const user1 = userEvent.setup();
    const render1 = render(
      <MemoryRouter initialEntries={["/fixture-trip"]}>
        <Routes>
          <Route path="/:slug" element={<TripPage />} />
        </Routes>
      </MemoryRouter>
    );
    const tile1 = await waitFor(() => {
      const el = render1.container.querySelector('[role="button"]');
      if (!el) throw new Error("tile not rendered yet");
      return el as HTMLElement;
    });
    await user1.click(tile1);
    const checkbox1 = await waitFor(() => {
      const el = render1.container.querySelector('dialog[open] input[type="checkbox"]');
      if (!el) throw new Error("dialog not open yet");
      return el as HTMLInputElement;
    });
    await user1.click(checkbox1);
    await user1.click(findButtonByText(render1.container, "dialog[open] button", "Save"));
    await waitFor(() => expect(checkedStore.size).toBe(1));
    expect(tile1.querySelector('[aria-hidden="true"]')).not.toBeNull();
    render1.unmount();

    // --- 2. "Reload": remount at version 1 again. The tick should already
    // be there, with no interaction -- driven by the GET response alone. ---
    vi.mocked(loadTrip).mockResolvedValueOnce(tripV1);
    const render2 = render(
      <MemoryRouter initialEntries={["/fixture-trip"]}>
        <Routes>
          <Route path="/:slug" element={<TripPage />} />
        </Routes>
      </MemoryRouter>
    );
    const tile2 = await waitFor(() => {
      const el = render2.container.querySelector('[role="button"]');
      if (!el) throw new Error("tile not rendered yet");
      return el as HTMLElement;
    });
    await waitFor(() => expect(tile2.querySelector('[aria-hidden="true"]')).not.toBeNull());
    render2.unmount();

    // --- 3. A different version of the same trip: fresh cellIds, so the
    // GET (scoped to version 2) must come back with nothing checked, even
    // though checkedStore itself already has an entry from step 1. ---
    vi.mocked(loadTrip).mockResolvedValueOnce(tripV2);
    const render3 = render(
      <MemoryRouter initialEntries={["/fixture-trip"]}>
        <Routes>
          <Route path="/:slug" element={<TripPage />} />
        </Routes>
      </MemoryRouter>
    );
    const tile3 = await waitFor(() => {
      const el = render3.container.querySelector('[role="button"]');
      if (!el) throw new Error("tile not rendered yet");
      return el as HTMLElement;
    });
    // Give the GET a real chance to resolve and (incorrectly) mark this
    // checked before asserting it never does.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tile3.querySelector('[aria-hidden="true"]')).toBeNull();
    render3.unmount();
  });
});
