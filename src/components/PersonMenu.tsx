import type { RefObject } from "react";
import { TintToggle } from "./TintToggle";

interface PersonMenuProps {
  people: string[];
  tintsEnabled: boolean;
  onTintsChange: (enabled: boolean) => void;
  dialogRef: RefObject<HTMLDialogElement>;
}

const legend: { label: string; swatchClass: string }[] = [
  { label: "Easy", swatchClass: "bg-difficulty-easy" },
  { label: "Medium", swatchClass: "bg-difficulty-medium" },
  { label: "Hard", swatchClass: "bg-difficulty-hard" },
];

export function PersonMenu({ people, tintsEnabled, onTintsChange, dialogRef }: PersonMenuProps) {
  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-0 mt-auto mx-auto w-full max-w-none rounded-t-3xl md:m-auto md:w-auto md:min-w-80 md:max-w-md md:rounded-2xl bg-surface text-ink p-6 backdrop:bg-black/60"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">People</h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex items-center justify-center min-h-11 min-w-11 -mt-2 -mr-2 rounded-full text-ink-muted hover:text-ink text-3xl leading-none"
        >
          &times;
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2 mb-4">
        {people.map((person) => (
          <li key={person}>
            <a
              href={`#${person}`}
              onClick={close}
              className="flex items-center justify-center min-h-12 rounded-lg bg-background text-foreground px-3 py-2 text-base"
            >
              {person}
            </a>
          </li>
        ))}
      </ul>

      <div className="border-t border-ink-muted/20 pt-4 mb-4">
        <p className="text-sm text-ink-muted mb-2">Difficulty tints</p>
        <ul className="flex flex-wrap gap-3">
          {legend.map(({ label, swatchClass }) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              <span className={`inline-block w-3 h-3 rounded-full ${swatchClass}`} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-ink-muted/20 pt-4">
        <TintToggle enabled={tintsEnabled} onChange={onTintsChange} />
      </div>
    </dialog>
  );
}
