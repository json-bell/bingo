import type { Grid as GridData } from "../../types/trip";
import { BingoItem } from "./BingoItem";

interface GridProps {
  grid: GridData;
  person: string;
  tintsEnabled: boolean;
}

export function Grid({ grid, person, tintsEnabled }: GridProps) {
  return (
    <div className="inline-grid grid-cols-[repeat(5,100px)] md:grid-cols-[repeat(5,200px)] gap-1 md:gap-2 bg-surface">
      {grid.flat().map((bingoItem) => {
        return (
          <BingoItem
            key={bingoItem.id}
            bingoItem={bingoItem}
            person={person}
            tintsEnabled={tintsEnabled}
          />
        );
      })}
    </div>
  );
}
