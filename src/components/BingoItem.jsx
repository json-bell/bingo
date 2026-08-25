export function BingoItem({ index, bingoItem }) {
  const { type, summary, description, difficulty } = bingoItem;
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
