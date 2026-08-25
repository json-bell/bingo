import PropTypes from "prop-types";

export function BingoItem({ bingoItem }) {
  const { summary, description, difficulty } = bingoItem;
  return (
    <div
      key={`bingo${summary}`}
      className={"bingo-item" + ` difficulty-${difficulty}`}
    >
      <h3>{summary.toUpperCase()}</h3>
      <p>{description}</p>
    </div>
  );
}

BingoItem.propTypes = {
  bingoItem: PropTypes.shape({
    type: PropTypes.string,
    summary: PropTypes.string.isRequired,
    description: PropTypes.string,
    difficulty: PropTypes.string,
  }).isRequired,
};
