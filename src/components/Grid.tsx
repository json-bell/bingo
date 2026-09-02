import type { Grid as GridData } from "../../types/trip";
import { Tile } from "./Tile";
import { BingoLines } from "./BingoLines";

// Shared between the real (Tile) grid and the decorative overlay grid below
// so the two can never drift out of pixel alignment from each other.
const TRACK_COLS = "grid-cols-[repeat(5,100px)] md:grid-cols-[repeat(5,200px)]";
const TRACK_ROWS = "grid-rows-[repeat(5,100px)] md:grid-rows-[repeat(5,200px)]";
const TRACK_GAP = "gap-1 md:gap-2";

interface GridProps {
  grid: GridData;
  person: string;
  tintsEnabled: boolean;
  // Extra classes appended to the grid's own div -- e.g. TripPage's
  // zoom-to-fill scale transform. Grid stays unaware of what zoom-to-fill
  // is; it just renders at its natural fixed-px size and lets a consumer
  // layer positioning/transform styles on top.
  className?: string;
}

export function Grid({
  grid,
  person,
  tintsEnabled,
  className = ""
}: GridProps) {
  return (
    <div className={`relative inline-block ${className}`}>
      <div className={`inline-grid ${TRACK_COLS} ${TRACK_GAP} bg-surface`}>
        {grid.flat().map((cell) => {
          return (
            <Tile
              key={cell.id}
              cell={cell}
              person={person}
              tintsEnabled={tintsEnabled}
            />
          );
        })}
      </div>
      {/* A separate grid, not a shared one with the Tiles above: CSS Grid's
          auto-placement algorithm reserves cells for anything with an
          explicit grid-row/grid-column first, then places auto-positioned
          items (every Tile above has no explicit position) around those
          reservations -- so a completed-line div spanning row 2 would make
          some Tiles skip that row and silently break the 5x5 layout if it
          were a sibling of them instead. This overlay grid shares the exact
          same tracks purely so line placement lines up visually; it has no
          effect on the real grid's own auto-placement.
          pointer-events-none is load-bearing, not decorative: this box
          fully overlaps every Tile, and without it would swallow every
          click.
          Opacity lives here, on the container, not on each individual line
          in BingoLines.tsx -- opacity on a shared ancestor composites its
          children together at full opacity first (overlapping solid
          bg-bingo-line divs just paint solid, no blending) and fades that
          flattened result as one layer, so two completed lines sharing a
          cell (e.g. row-0 and col-0 meeting at a corner) stay a uniform
          opacity instead of compounding -- two independently-25%-opacity
          divs stacked would read as ~44% where they cross, not 25%. */}
      <div
        className={`absolute inset-0 pointer-events-none grid ${TRACK_COLS} ${TRACK_ROWS} ${TRACK_GAP} opacity-75`}
        aria-hidden="true"
      >
        <BingoLines grid={grid} />
      </div>
    </div>
  );
}
