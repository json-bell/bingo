import { describe, it, expect } from "vitest";
import { getGrids } from "./getGrids";
import type { BingoItem, Difficulty } from "../types/trip";

function makeEvents(difficulty: Difficulty, count: number, prefix: string): BingoItem[] {
  return Array.from({ length: count }, (_, i) => ({
    difficulty,
    summary: `${prefix}-${i}`,
    description: `Filler event ${prefix}-${i}`,
  }));
}

// makeGrid() draws from a freshly-shuffled *copy* of the full pool for every
// grid it builds (see data/getGrids.ts), not a shared diminishing pool across
// people — so 8 of each difficulty (matching difficultyKey's own counts) is
// enough regardless of how many people are requested.
function buildFixtureRows(overrides: Partial<Record<"e" | "m" | "h", BingoItem[]>> = {}): BingoItem[] {
  return [
    ...(overrides.e ?? makeEvents("e", 8, "easy")),
    ...(overrides.m ?? makeEvents("m", 8, "med")),
    ...(overrides.h ?? makeEvents("h", 8, "hard")),
  ];
}

const characters = ["Alice", "Bob"];
const people = ["Person A", "Person B", "Person C"];

describe("getGrids", () => {
  it("produces one 5x5 grid per person", () => {
    const rows = buildFixtureRows();
    const grids = getGrids({ data: { rows }, characters, people });

    expect(grids).toHaveLength(people.length);
    for (const grid of grids) {
      expect(grid).toHaveLength(5);
      grid.forEach((row) => expect(row).toHaveLength(5));
    }
  });

  it("lays out difficulties matching the documented pattern, with free at the center", () => {
    const rows = buildFixtureRows();
    const [grid] = getGrids({ data: { rows }, characters, people: ["Solo"] });

    expect(grid[2][2].difficulty).toBe("f");
    expect(grid[2][2].summary).toBe("free");
    expect(grid[0][0].difficulty).toBe("h");
    expect(grid[0][1].difficulty).toBe("e");
    expect(grid[1][1].difficulty).toBe("m");
  });

  it("assigns every cell a unique id", () => {
    const rows = buildFixtureRows();
    const [grid] = getGrids({ data: { rows }, characters, people: ["Solo"] });

    const ids = grid.flat().map((cell) => cell.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never repeats the same source event within one person's grid", () => {
    const rows = buildFixtureRows();
    const [grid] = getGrids({ data: { rows }, characters, people: ["Solo"] });

    const summaries = grid.flat().map((cell) => cell.summary);
    expect(new Set(summaries).size).toBe(summaries.length);
  });

  it("places exactly one 'jersey number' cell, among the medium-difficulty cells", () => {
    const rows = buildFixtureRows();
    const [grid] = getGrids({ data: { rows }, characters, people: ["Solo"] });

    const jerseyCells = grid.flat().filter((cell) => cell.summary === "jersey number");
    expect(jerseyCells).toHaveLength(1);
    expect(jerseyCells[0].difficulty).toBe("m");
  });

  it("appends a character name to hug/fistbump events", () => {
    const rows = buildFixtureRows({
      e: [
        { difficulty: "e", summary: "hug", description: "hug" },
        ...makeEvents("e", 7, "easy"),
      ],
    });
    const [grid] = getGrids({ data: { rows }, characters, people: ["Solo"] });

    const hugCell = grid.flat().find((cell) => cell.summary === "hug");
    expect(hugCell).toBeDefined();
    expect(characters.some((name) => hugCell?.description.includes(name))).toBe(true);
  });

  it("throws a clear error instead of crashing when a difficulty runs short", () => {
    // Regression guard: under strict TypeScript, Array.prototype.pop() returns
    // T | undefined, which surfaced a real latent crash-on-undefined bug here.
    const rows = buildFixtureRows({ h: makeEvents("h", 7, "hard") });

    expect(() => getGrids({ data: { rows }, characters, people: ["Solo"] })).toThrow(
      /ran out of "h" difficulty events/i
    );
  });
});
