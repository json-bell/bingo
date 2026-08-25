import PropTypes from "prop-types";
import { BingoItem } from "./BingoItem";

export function Grid({ grid }) {
  return (
    <div className="inline-grid grid-cols-[repeat(5,200px)] bg-white">
      {grid.flat().map((bingoItem, index) => {
        return <BingoItem key={index} bingoItem={bingoItem} />;
      })}
    </div>
  );
}

Grid.propTypes = {
  grid: PropTypes.array.isRequired,
};
