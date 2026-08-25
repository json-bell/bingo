import PropTypes from "prop-types";
import { BingoItem } from "./BingoItem";

export function Grid({ grid }) {
  return (
    <div className="bingo-grid">
      {grid.flat().map((bingoItem, index) => {
        return <BingoItem key={index} bingoItem={bingoItem} />;
      })}
    </div>
  );
}

Grid.propTypes = {
  grid: PropTypes.array.isRequired,
};
