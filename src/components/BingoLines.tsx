import type { CSSProperties } from "react";
import type { Grid as GridData } from "../../types/trip";
import { useChecked } from "../context/CheckedContext";
import { getCompletedLines } from "../lib/bingoLines";
import type { BingoLine } from "../lib/bingoLines";

// Literal Tailwind classes only -- these must stay fully static strings, not
// built via template interpolation of a constant, even though the values
// themselves are fixed: Tailwind's scanner greps source text at build time,
// so a class assembled at runtime (e.g. `left-[${EDGE_INSET}]`) never
// matches anything it generates CSS for and silently renders with no style
// at all. See src/components/QueueStatus.tsx's own comment for the same
// gotcha. Only the grid-row/grid-column placement below is genuinely
// per-render data (which line, which index) -- that goes through inline
// `style`, everything else here is a literal class.
//
// 8px/16px inset from the grid's edge, and a thin, tight look -- deliberately
// thinner than the checked-mark cross's own bar (Tile.tsx: h-[6px] md:h-[10px]),
// both explicit product choices, not computed from tile/gap math. Tune by
// eye (docs/visual-verification.md) if the look needs adjusting.
// Opacity is deliberately NOT part of these classes -- it lives once on the
// shared overlay container in Grid.tsx, so multiple simultaneously completed
// lines that share a cell composite as one flattened group before fading,
// instead of compounding opacity where they cross. See Grid.tsx's comment
// on that container.
const ROW_LINE_CLASS =
  "absolute top-1/2 left-[8px] right-[8px] md:left-[16px] md:right-[16px] h-[3px] md:h-[4px] -translate-y-1/2 rounded-full bg-bingo-line";
const COL_LINE_CLASS =
  "absolute left-1/2 top-[8px] bottom-[8px] md:top-[16px] md:bottom-[16px] w-[3px] md:w-[4px] -translate-x-1/2 rounded-full bg-bingo-line";
// Same w-[142%] (√2 scaling) rotated-pill trick Tile.tsx already uses for
// its own checked-mark X, just scaled up from one tile to the whole grid --
// but shortened via calc() so it stops short of the true corners, matching
// the row/col lines' fixed edge inset instead of running truly corner-to-
// corner. The 142% trick's raw length passes exactly through all 4 corners
// at zero inset; shrinking total length by Xpx pulls each end in along the
// diagonal by X/2, which projects to an axis-aligned inset of (X/2)/sqrt(2)
// (a 45-degree line's horizontal/vertical component) -- an angled inset
// reads as visually smaller than a straight-line inset of the same raw
// pixel value for exactly this reason, so this needs a noticeably bigger
// raw subtraction than the row/col lines' fixed inset to *look* comparable.
// 40px/80px here works out to ~14px/28px of axis-aligned inset. Tune by eye
// (docs/visual-verification.md) if it still needs adjusting.
// rotate-45 (clockwise) draws "\" (top-left to bottom-right, the main
// diagonal); -rotate-45 draws "/" (the anti-diagonal).
const DIAG_MAIN_LINE_CLASS =
  "absolute top-1/2 left-1/2 h-[3px] md:h-[4px] w-[calc(142%-40px)] md:w-[calc(142%-80px)] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-bingo-line";
const DIAG_ANTI_LINE_CLASS =
  "absolute top-1/2 left-1/2 h-[3px] md:h-[4px] w-[calc(142%-40px)] md:w-[calc(142%-80px)] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-bingo-line";

function lineWrapperStyle(line: BingoLine): CSSProperties {
  if (line.axis === "row")
    return { gridRow: line.index + 1, gridColumn: "1 / span 5" };
  if (line.axis === "col")
    return { gridRow: "1 / span 5", gridColumn: line.index + 1 };
  return { gridRow: "1 / span 5", gridColumn: "1 / span 5" }; // both diagonals span the whole grid
}

export function BingoLines({ grid }: { grid: GridData }) {
  const { isChecked } = useChecked();
  const completedLines = getCompletedLines(grid, isChecked);

  return (
    <>
      {completedLines.map((line) => (
        <div key={line.id} className="relative" style={lineWrapperStyle(line)}>
          {line.axis === "row" && <div className={ROW_LINE_CLASS} />}
          {line.axis === "col" && <div className={COL_LINE_CLASS} />}
          {line.axis === "diag-main" && (
            <div className={DIAG_MAIN_LINE_CLASS} />
          )}
          {line.axis === "diag-anti" && (
            <div className={DIAG_ANTI_LINE_CLASS} />
          )}
        </div>
      ))}
    </>
  );
}
