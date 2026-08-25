import type { BingoItem as BingoItemData, Difficulty } from "../../types/trip";

const difficultyBg: Partial<Record<Difficulty, string>> = {
  e: "bg-[rgba(116,199,116,var(--difficulty-intensity))]",
  m: "bg-[rgba(199,198,116,var(--difficulty-intensity))]",
  h: "bg-[rgba(199,126,116,var(--difficulty-intensity))]",
};

interface BingoItemProps {
  bingoItem: BingoItemData;
}

export function BingoItem({ bingoItem }: BingoItemProps) {
  const { summary, description, difficulty } = bingoItem;
  const bgClass = difficultyBg[difficulty] ?? "bg-[rgba(255,255,255,0.8)]";
  return (
    <div
      key={`bingo${summary}`}
      className={`h-[180px] ${bgClass} border-2 border-[rgba(0,0,0,0.7)] px-[0.1rem] py-[0.1rem] text-base text-center [&>*]:my-2 [&>*]:mx-1`}
    >
      <h3 className="text-[1.17em] font-bold">{summary.toUpperCase()}</h3>
      <p>{description}</p>
    </div>
  );
}
