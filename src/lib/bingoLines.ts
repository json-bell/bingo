import type { Grid } from "../../types/trip";

// The 12 possible bingo lines on a 5x5 grid: 5 rows, 5 columns, 2 diagonals.
// Pure geometry + completion check, no React -- same seam style as
// data/getGrids.ts/src/lib/checked.ts, so this stays trivially unit-testable
// against real data with no mocking.

export type BingoLineAxis = "row" | "col" | "diag-main" | "diag-anti";

export interface BingoLine {
  id: string; // "row-0".."row-4", "col-0".."col-4", "diag-main", "diag-anti"
  axis: BingoLineAxis;
  index: number; // 0-4 for row/col; -1 (unused) for diagonals
  cells: { row: number; col: number }[]; // 5 entries
}

const GRID_SIZE = 5;

function buildBingoLines(): BingoLine[] {
  const lines: BingoLine[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    lines.push({
      id: `row-${row}`,
      axis: "row",
      index: row,
      cells: Array.from({ length: GRID_SIZE }, (_, col) => ({ row, col })),
    });
  }

  for (let col = 0; col < GRID_SIZE; col++) {
    lines.push({
      id: `col-${col}`,
      axis: "col",
      index: col,
      cells: Array.from({ length: GRID_SIZE }, (_, row) => ({ row, col })),
    });
  }

  lines.push({
    id: "diag-main",
    axis: "diag-main",
    index: -1,
    cells: Array.from({ length: GRID_SIZE }, (_, i) => ({ row: i, col: i })),
  });

  lines.push({
    id: "diag-anti",
    axis: "diag-anti",
    index: -1,
    cells: Array.from({ length: GRID_SIZE }, (_, i) => ({ row: i, col: GRID_SIZE - 1 - i })),
  });

  return lines;
}

// Computed once at module load -- static geometry, not per-render work.
export const BINGO_LINES: BingoLine[] = buildBingoLines();

// countFreeAsChecked defaults to false: the center "free" cell must be
// explicitly checked like any other cell, not treated as pre-marked --
// settled deliberately (ticking the center is usually someone's first
// action on a fresh grid, so auto-counting it would make the center
// row/column/both diagonals trivially "half done" from the first click).
export function getCompletedLines(
  grid: Grid,
  isChecked: (cellId: string) => boolean,
  countFreeAsChecked = false
): BingoLine[] {
  return BINGO_LINES.filter((line) =>
    line.cells.every(({ row, col }) => {
      const cell = grid[row][col];
      return (countFreeAsChecked && cell.difficulty === "f") || isChecked(cell.id);
    })
  );
}
