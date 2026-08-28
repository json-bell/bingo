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
    type: "filler",
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
});
