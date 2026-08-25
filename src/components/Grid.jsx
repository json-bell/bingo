import { BingoItem } from "./BingoItem";

export function Grid({ grid }) {
  return (
    <div className="bingo-grid">
      {grid.flat().map((bingoItem, index) => {
        return <BingoItem key={index} index={index} bingoItem={bingoItem} />;
      })}
    </div>
  );
}
