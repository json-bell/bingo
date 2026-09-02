import { describe, it, expect } from "vitest";
import { BINGO_LINES, getCompletedLines } from "./bingoLines";
import type { Grid, GridCell } from "../../types/trip";

// difficulty "f" only at (2,2), matching data/getGrids.ts's real
// difficultyKey layout -- everything else is filler, this module doesn't
// care about difficulty beyond distinguishing the free cell.
function makeGrid(): Grid {
  const grid: GridCell[][] = [];
  for (let row = 0; row < 5; row++) {
    const rowCells: GridCell[] = [];
    for (let col = 0; col < 5; col++) {
      const isFree = row === 2 && col === 2;
      rowCells.push({
        id: cellId(row, col),
        difficulty: isFree ? "f" : "e",
        summary: isFree ? "free" : `event-${row}-${col}`,
        description: isFree ? "free" : `Event ${row},${col}`,
      });
    }
    grid.push(rowCells);
  }
  return grid;
}

function cellId(row: number, col: number): string {
  return `r${row}c${col}`;
}

function isCheckedFrom(ids: Iterable<string>): (cellId: string) => boolean {
  const set = new Set(ids);
  return (id) => set.has(id);
}

describe("BINGO_LINES", () => {
  it("has exactly 12 lines (5 rows + 5 cols + 2 diagonals), each with 5 unique in-bounds cells", () => {
    expect(BINGO_LINES).toHaveLength(12);
    for (const line of BINGO_LINES) {
      expect(line.cells).toHaveLength(5);
      const seen = new Set(line.cells.map((c) => `${c.row},${c.col}`));
      expect(seen.size).toBe(5);
      for (const { row, col } of line.cells) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(5);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(5);
      }
    }
  });
});

describe("getCompletedLines", () => {
  it("returns nothing when no cells are checked", () => {
    const grid = makeGrid();
    expect(getCompletedLines(grid, isCheckedFrom([]))).toEqual([]);
  });

  it("returns exactly the one row when a full row is checked", () => {
    const grid = makeGrid();
    const ids = [0, 1, 2, 3, 4].map((col) => cellId(1, col));
    const completed = getCompletedLines(grid, isCheckedFrom(ids));
    expect(completed.map((l) => l.id)).toEqual(["row-1"]);
  });

  it("returns exactly the one column when a full column is checked", () => {
    const grid = makeGrid();
    const ids = [0, 1, 2, 3, 4].map((row) => cellId(row, 3));
    const completed = getCompletedLines(grid, isCheckedFrom(ids));
    expect(completed.map((l) => l.id)).toEqual(["col-3"]);
  });

  it("returns the main diagonal when it's fully checked (including the free cell)", () => {
    const grid = makeGrid();
    const ids = [0, 1, 2, 3, 4].map((i) => cellId(i, i));
    const completed = getCompletedLines(grid, isCheckedFrom(ids));
    expect(completed.map((l) => l.id)).toEqual(["diag-main"]);
  });

  it("returns the anti-diagonal when it's fully checked", () => {
    const grid = makeGrid();
    const ids = [0, 1, 2, 3, 4].map((i) => cellId(i, 4 - i));
    const completed = getCompletedLines(grid, isCheckedFrom(ids));
    expect(completed.map((l) => l.id)).toEqual(["diag-anti"]);
  });

  it("returns multiple simultaneously-completed lines that share a corner cell", () => {
    const grid = makeGrid();
    const rowIds = [0, 1, 2, 3, 4].map((col) => cellId(0, col));
    const colIds = [0, 1, 2, 3, 4].map((row) => cellId(row, 0));
    const completed = getCompletedLines(grid, isCheckedFrom([...rowIds, ...colIds]));
    expect(completed.map((l) => l.id).sort()).toEqual(["col-0", "row-0"]);
  });

  it("does not count a near-miss (4 of 5 checked)", () => {
    const grid = makeGrid();
    const ids = [0, 1, 2, 3].map((col) => cellId(2, col)); // missing (2,4)
    expect(getCompletedLines(grid, isCheckedFrom(ids))).toEqual([]);
  });

  it("does not count a line through the free cell when the free cell itself is unchecked (default)", () => {
    const grid = makeGrid();
    // Row 2 passes through the free cell at (2,2) -- check every other cell in it.
    const ids = [0, 1, 3, 4].map((col) => cellId(2, col));
    expect(getCompletedLines(grid, isCheckedFrom(ids))).toEqual([]);
  });

  it("counts a line through the free cell once the free cell is also explicitly checked", () => {
    const grid = makeGrid();
    const ids = [0, 1, 2, 3, 4].map((col) => cellId(2, col));
    const completed = getCompletedLines(grid, isCheckedFrom(ids));
    expect(completed.map((l) => l.id)).toEqual(["row-2"]);
  });

  it("countFreeAsChecked: true treats the free cell as already checked", () => {
    const grid = makeGrid();
    const ids = [0, 1, 3, 4].map((col) => cellId(2, col)); // free cell (2,2) NOT in this list
    const completed = getCompletedLines(grid, isCheckedFrom(ids), true);
    expect(completed.map((l) => l.id)).toEqual(["row-2"]);
  });

  it("returns all 12 lines when the entire board is checked", () => {
    const grid = makeGrid();
    const ids = grid.flat().map((cell) => cell.id);
    const completed = getCompletedLines(grid, isCheckedFrom(ids));
    expect(completed).toHaveLength(12);
  });
});
