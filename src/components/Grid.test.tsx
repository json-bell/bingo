import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../lib/msw/server";
import { CheckedProvider } from "../context/CheckedContext";
import { Grid } from "./Grid";
import { getGrids } from "../../data/getGrids";
import type { BingoItem, Difficulty } from "../../types/trip";

// Grid+BingoLines wiring only -- the 12-line geometry itself is covered
// purely in src/lib/bingoLines.test.ts. This goes through the real
// CheckedProvider + msw (network-layer interception, not a stubbed context
// value -- CheckedContext.tsx doesn't export one), same "seam not mock"
// approach as src/pages/TripPage.gridVersionIsolation.test.tsx.

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

describe("Grid: renders a completed-line overlay from real checked state", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    server.resetHandlers();
  });

  it("renders no line when nothing is checked", async () => {
    const [grid] = getGrids({ data: { rows: buildFixtureRows() }, characters, people: ["Solo"] });
    server.use(
      http.get("/api/trips/:slug/checked", ({ params }) =>
        HttpResponse.json({
          slug: params.slug,
          version: 1,
          cells: {},
          generatedAt: new Date().toISOString(),
        })
      )
    );

    const { container } = render(
      <CheckedProvider tripSlug="grid-test-trip" version={1}>
        <Grid grid={grid} person="Solo" tintsEnabled={false} />
      </CheckedProvider>
    );

    await waitFor(() => expect(container.querySelectorAll('[role="button"]')).toHaveLength(25));
    expect(container.querySelectorAll(".bg-bingo-line")).toHaveLength(0);
  });

  it("renders exactly one line once a full row's cells are checked", async () => {
    // Row 0 in difficultyKey's layout ("h","e","m","e","h") has no free
    // cell, so this doesn't need to touch the free-cell-inclusion behavior
    // covered separately in bingoLines.test.ts.
    const [grid] = getGrids({ data: { rows: buildFixtureRows() }, characters, people: ["Solo"] });
    const rowZeroIds = grid[0].map((cell) => cell.id);
    const cells: Record<string, { checked: boolean; updatedAt: string }> = {};
    for (const id of rowZeroIds) {
      cells[id] = { checked: true, updatedAt: new Date().toISOString() };
    }
    server.use(
      http.get("/api/trips/:slug/checked", ({ params }) =>
        HttpResponse.json({ slug: params.slug, version: 1, cells, generatedAt: new Date().toISOString() })
      )
    );

    const { container } = render(
      <CheckedProvider tripSlug="grid-test-trip" version={1}>
        <Grid grid={grid} person="Solo" tintsEnabled={false} />
      </CheckedProvider>
    );

    await waitFor(() => expect(container.querySelectorAll(".bg-bingo-line")).toHaveLength(1));
  });
});
