import { useRef } from "react";
import type { GridCell, Difficulty } from "../../types/trip";
import { useChecked } from "../context/CheckedContext";

const tint: Partial<Record<Difficulty, string>> = {
  e: "bg-tile-easy",
  m: "bg-tile-medium",
  h: "bg-tile-hard",
};

interface TileProps {
  cell: GridCell;
  person: string;
  tintsEnabled: boolean;
}

export function Tile({ cell, person, tintsEnabled }: TileProps) {
  const { id, summary, description, difficulty } = cell;
  const bgClass = tintsEnabled ? (tint[difficulty] ?? "bg-tile") : "bg-tile";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { isChecked, updateChecked } = useChecked();
  const checked = isChecked(person, id);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className={`cursor-pointer aspect-square flex flex-col justify-center ${bgClass} text-tile-foreground rounded-lg border-2 border-tile-foreground/20 p-[4px] md:p-[8px] text-base text-center`}
      >
        <h3
          className={`text-[12px] md:text-[1.17em] font-bold my-[2px] md:my-[5px] ${checked ? "opacity-50 line-through" : ""}`}
        >
          {summary.toUpperCase()}
        </h3>
        <p
          className={`line-clamp-3 text-[10px] md:text-[0.9rem] mx-[2px] md:mx-[4px] ${checked ? "opacity-50" : ""}`}
        >
          {description}
        </p>
      </div>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto bg-tile text-tile-foreground rounded-lg p-6 max-w-sm backdrop:bg-black/50"
      >
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-xl font-bold">{summary.toUpperCase()}</h3>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-tile-foreground/60 hover:text-tile-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <p className="mt-2">{description}</p>
        <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => updateChecked(person, id, e.target.checked)}
            className="w-5 h-5 cursor-pointer accent-brand"
          />
          Mark as checked
        </label>
      </dialog>
    </>
  );
}
