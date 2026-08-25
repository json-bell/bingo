import type { BingoItem as BingoItemData, Difficulty } from "../../types/trip";

const tint: Partial<Record<Difficulty, string>> = {
  e: "bg-difficulty-easy/10",
  m: "bg-difficulty-medium/10",
  h: "bg-difficulty-hard/10",
};

interface BingoItemProps {
  bingoItem: BingoItemData;
}

export function BingoItem({ bingoItem }: BingoItemProps) {
  const { summary, description, difficulty } = bingoItem;
  const bgClass = tint[difficulty] ?? "bg-surface";
  return (
    <div
      key={`bingo${summary}`}
      className={`h-[180px] ${bgClass} text-ink rounded-lg border-2 border-ink/20 px-[0.1rem] py-[0.1rem] text-base text-center [&>*]:my-2 [&>*]:mx-1`}
    >
      <h3 className="text-[1.17em] font-bold">{summary.toUpperCase()}</h3>
      <p>{description}</p>
    </div>
  );
}
