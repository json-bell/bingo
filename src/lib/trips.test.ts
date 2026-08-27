import { describe, it, expect } from "vitest";
import { listSlugs, loadTrip } from "./trips";

// Runs against the real europapark-2024 fixture data already in the repo —
// no mocking of import.meta.glob or config/trips.json needed (see docs/test-plan.md).
describe("trips", () => {
  it("lists every slug known to config/trips.json", () => {
    expect(listSlugs()).toContain("europapark-2024");
  });

  it("loads a real trip's grids, people, and title consistently", async () => {
    const trip = await loadTrip("europapark-2024");

    expect(trip).not.toBeNull();
    expect(trip?.title).toBe("Europapark 2024 Bingo!!");
    expect(trip?.grids).toHaveLength(trip?.people.length ?? -1);
    for (const grid of trip?.grids ?? []) {
      expect(grid).toHaveLength(5);
    }
  });

  it("returns null for a slug that doesn't exist", async () => {
    const trip = await loadTrip("not-a-real-trip");
    expect(trip).toBeNull();
  });
});
