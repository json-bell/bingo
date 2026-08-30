import { useRef, useState } from "react";
import type { GridCell, Difficulty } from "../../types/trip";
import { useChecked } from "../context/CheckedContext";
import { Modal } from "./Modal";
import { Switch } from "./Switch";

const tint: Partial<Record<Difficulty, string>> = {
  e: "bg-tile-easy",
  m: "bg-tile-medium",
  h: "bg-tile-hard"
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
  const checked = isChecked(id);

  // Draft state for the modal only — the switch toggles this, not the real
  // checked state. Only "Save" commits it; Cancel/backdrop-click/Escape all
  // just close without ever calling updateChecked, so they discard the draft
  // for free rather than needing explicit "revert" handling.
  const [draftChecked, setDraftChecked] = useState(checked);

  const open = () => {
    setDraftChecked(checked);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const save = () => {
    updateChecked(id, draftChecked);
    close();
  };

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
        className={`relative cursor-pointer aspect-square min-h-0 overflow-hidden flex flex-col justify-center ${bgClass} text-tile-foreground rounded-lg border-2 border-tile-foreground/20 p-[4px] md:p-[8px] text-base text-center`}
      >
        {checked && (
          <div
            className="absolute inset-[18%] pointer-events-none"
            aria-hidden="true"
          >
            <div className="absolute top-1/2 left-1/2 h-[6px] md:h-[10px] w-[142%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-checked-mark" />
            <div className="absolute top-1/2 left-1/2 h-[6px] md:h-[10px] w-[142%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-checked-mark" />
          </div>
        )}
        <h3
          className={`text-[12px] md:text-[1.17em] font-bold my-[2px] md:my-[5px] ${checked ? "opacity-50" : ""}`}
        >
          {summary.toUpperCase()}
        </h3>
        <p
          className={`line-clamp-3 text-[10px] md:text-[0.9rem] mx-[2px] md:mx-[4px] ${checked ? "opacity-50" : ""}`}
        >
          {description}
        </p>
      </div>

      <Modal
        dialogRef={dialogRef}
        className="m-auto w-full max-w-sm rounded-[var(--modal-radius)] [--modal-radius:0.5rem]"
      >
        <p className="text-xl text-accent text-left">{person}</p>
        <hr className="mt-2 mb-4 border-ink-muted/20" />
        <div className="text-center">
          <h3 className="text-xl font-bold">{summary.toUpperCase()}</h3>
          <p className="mt-2">{description}</p>
          <div className="mt-4 flex justify-center">
            <Switch
              label="Mark as checked"
              checked={draftChecked}
              onChange={setDraftChecked}
            />
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 rounded-lg text-ink-muted hover:text-ink font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="px-4 py-2 rounded-lg bg-brand text-brand-foreground font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
