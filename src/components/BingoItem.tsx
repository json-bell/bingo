import type { BingoItem as BingoItemData, Difficulty } from "../../types/trip";

const difficultyBorder: Partial<Record<Difficulty, string>> = {
  e: "border-difficulty-easy",
  m: "border-difficulty-medium",
  h: "border-difficulty-hard",
};

interface BingoItemProps {
  bingoItem: BingoItemData;
}

export function BingoItem({ bingoItem }: BingoItemProps) {
  const { summary, description, difficulty } = bingoItem;
  const borderClass = difficultyBorder[difficulty] ?? "border-ink/40";
  return (
    <div
      key={`bingo${summary}`}
      className={`h-[180px] bg-surface text-ink border-4 ${borderClass} px-[0.1rem] py-[0.1rem] text-base text-center [&>*]:my-2 [&>*]:mx-1`}
    >
      <h3 className="text-[1.17em] font-bold">{summary.toUpperCase()}</h3>
      <p>{description}</p>
    </div>
  );
}
