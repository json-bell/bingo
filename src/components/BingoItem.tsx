import type { BingoItem as BingoItemData, Difficulty } from "../../types/trip";

// Paired with a text color that meets contrast against that specific
// background — a flat text color doesn't work across this whole ramp.
const difficultyStyle: Partial<Record<Difficulty, { bg: string; text: string }>> = {
  e: { bg: "bg-difficulty-easy", text: "text-ink" },
  m: { bg: "bg-difficulty-medium", text: "text-ink" },
  h: { bg: "bg-difficulty-hard", text: "text-foreground" },
};

interface BingoItemProps {
  bingoItem: BingoItemData;
}

export function BingoItem({ bingoItem }: BingoItemProps) {
  const { summary, description, difficulty } = bingoItem;
  const style = difficultyStyle[difficulty] ?? { bg: "bg-surface", text: "text-ink" };
  return (
    <div
      key={`bingo${summary}`}
      className={`h-[180px] ${style.bg} ${style.text} border-2 border-ink/70 px-[0.1rem] py-[0.1rem] text-base text-center [&>*]:my-2 [&>*]:mx-1`}
    >
      <h3 className="text-[1.17em] font-bold">{summary.toUpperCase()}</h3>
      <p>{description}</p>
    </div>
  );
}
