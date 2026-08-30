import type { Grid as GridData } from "../../types/trip";
import { Tile } from "./Tile";

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

export function Grid({ grid, person, tintsEnabled, className = "" }: GridProps) {
  return (
    <div
      className={`inline-grid grid-cols-[repeat(5,100px)] md:grid-cols-[repeat(5,200px)] gap-1 md:gap-2 bg-surface ${className}`}
    >
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
  );
}
