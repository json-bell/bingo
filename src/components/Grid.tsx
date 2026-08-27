import type { Grid as GridData } from "../../types/trip";
import { BingoItem } from "./BingoItem";

interface GridProps {
  grid: GridData;
  tintsEnabled: boolean;
}

export function Grid({ grid, tintsEnabled }: GridProps) {
  return (
    <div className="inline-grid grid-cols-[repeat(5,100px)] md:grid-cols-[repeat(5,200px)] gap-1 md:gap-2 bg-surface">
      {grid.flat().map((bingoItem, index) => {
        return <BingoItem key={index} bingoItem={bingoItem} tintsEnabled={tintsEnabled} />;
      })}
    </div>
  );
}
