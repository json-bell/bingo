import type { Grid as GridData } from "../../types/trip";
import { BingoItem } from "./BingoItem";

interface GridProps {
  grid: GridData;
}

export function Grid({ grid }: GridProps) {
  return (
    <div className="inline-grid grid-cols-[repeat(5,200px)] gap-2 bg-surface">
      {grid.flat().map((bingoItem, index) => {
        return <BingoItem key={index} bingoItem={bingoItem} />;
      })}
    </div>
  );
}
