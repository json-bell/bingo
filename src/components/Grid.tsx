import type { Grid as GridData } from "../../types/trip";
import { Tile } from "./Tile";

interface GridProps {
  grid: GridData;
  person: string;
  tintsEnabled: boolean;
  zoomToFill: boolean;
}

export function Grid({ grid, person, tintsEnabled, zoomToFill }: GridProps) {
  return (
    <div
      className={
        zoomToFill
          ? "grid grid-cols-5 gap-1 md:gap-2 bg-surface w-full"
          : "inline-grid grid-cols-[repeat(5,100px)] md:grid-cols-[repeat(5,200px)] gap-1 md:gap-2 bg-surface"
      }
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
