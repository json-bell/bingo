import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { checked } from "../db/schema.js";
import { seedGrid } from "./seedGrid";
import { getGrids } from "./getGrids";
import type { BingoItem, Difficulty } from "../types/trip";

// Same fixture pattern as data/getGrids.test.ts.
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
const people = ["Person A", "Person B", "Person C"];

describe("seedGrid", () => {
  it("inserts one row per cell, with the correct person for each grid", async () => {
    const grids = getGrids({ data: { rows: buildFixtureRows() }, characters, people });

    const count = await seedGrid("test-slug", 1, grids, people);
    expect(count).toBe(people.length * 25);

    const rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, "test-slug"), eq(checked.gridVersion, 1)));
    expect(rows).toHaveLength(people.length * 25);

    for (let i = 0; i < people.length; i++) {
      const cellIdsForPerson = new Set(grids[i].flat().map((cell) => cell.id));
      const rowsForPerson = rows.filter((r) => r.person === people[i]);
      expect(rowsForPerson).toHaveLength(25);
      expect(rowsForPerson.every((r) => cellIdsForPerson.has(r.cellId))).toBe(true);
    }
  });

  it("throws on a grid/people length mismatch rather than silently mispairing", async () => {
    const grids = getGrids({ data: { rows: buildFixtureRows() }, characters, people });

    await expect(seedGrid("test-slug", 1, grids, people.slice(0, 2))).rejects.toThrow(
      /grid\/people mismatch/i
    );
  });

  it("throws on a cell without an id rather than inserting a null primary key", async () => {
    const [grid] = getGrids({ data: { rows: buildFixtureRows() }, characters, people: ["Solo"] });
    // Simulate a pre-backfill grid (grids/europapark-2024/1.json's shape).
    const gridWithoutIds = grid.map((row) => row.map(({ id: _id, ...rest }) => rest)) as unknown as (typeof grid);

    await expect(seedGrid("test-slug", 1, [gridWithoutIds], ["Solo"])).rejects.toThrow(/without an id/i);
  });

  it("is idempotent -- safe to re-run after a partial failure", async () => {
    const grids = getGrids({ data: { rows: buildFixtureRows() }, characters, people: ["Solo"] });

    await seedGrid("test-slug", 1, grids, ["Solo"]);
    await expect(seedGrid("test-slug", 1, grids, ["Solo"])).resolves.toBe(25);

    const rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, "test-slug"), eq(checked.gridVersion, 1)));
    expect(rows).toHaveLength(25);
  });

  it("keeps two grid versions of the same trip fully isolated from each other", async () => {
    // Same slug, two independent make-grid runs -- each mints its own fresh
    // cell ids (getGrids's crypto.randomUUID() per cell), so version 1 and
    // version 2 never share a cellId even though they share a tripSlug. This
    // is what config/trips.json's currentVersion switch relies on: swapping
    // which version is "live" reads/writes a disjoint set of rows, not a
    // shared one that could leak checked state across a promotion/rollback.
    const gridsV1 = getGrids({ data: { rows: buildFixtureRows() }, characters, people });
    const gridsV2 = getGrids({ data: { rows: buildFixtureRows() }, characters, people });

    await seedGrid("same-trip", 1, gridsV1, people);
    await seedGrid("same-trip", 2, gridsV2, people);

    const v1Rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, "same-trip"), eq(checked.gridVersion, 1)));
    const v2Rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, "same-trip"), eq(checked.gridVersion, 2)));

    expect(v1Rows).toHaveLength(people.length * 25);
    expect(v2Rows).toHaveLength(people.length * 25);

    const v1CellIds = new Set(gridsV1.flatMap((grid) => grid.flat().map((cell) => cell.id)));
    const v2CellIds = new Set(gridsV2.flatMap((grid) => grid.flat().map((cell) => cell.id)));
    expect(v1CellIds.size).toBe(v1Rows.length);
    expect(v1Rows.every((r) => v1CellIds.has(r.cellId))).toBe(true);
    expect(v2Rows.every((r) => v2CellIds.has(r.cellId))).toBe(true);
    // No overlap: promoting/rolling back a version can never point at the
    // other version's rows by accident.
    for (const id of v1CellIds) expect(v2CellIds.has(id)).toBe(false);

    // Flipping checked state on one version (simulating someone using the
    // trip while it's "live" at that version) must not touch the other.
    await db
      .update(checked)
      .set({ checked: true })
      .where(and(eq(checked.tripSlug, "same-trip"), eq(checked.gridVersion, 1)));

    const v2AfterV1Update = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, "same-trip"), eq(checked.gridVersion, 2)));
    expect(v2AfterV1Update.every((r) => r.checked === false)).toBe(true);
  });
});
