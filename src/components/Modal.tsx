import type { ReactNode, RefObject } from "react";

// Shared <dialog> shell -- see docs/future-features-draft-20260829.md's shared
// decision #1. Everything a consumer passes as children scrolls together as
// one body; the only thing that stays put regardless of scroll position is
// the close button this component renders itself, absolutely positioned in
// the top-right corner. Its own border/shadow gives it contrast over
// whatever's scrolling underneath, and that same shape is its (larger, more
// distinctive) touch target -- there's no separate header slot to pass.
interface ModalProps {
  dialogRef: RefObject<HTMLDialogElement>;
  children: ReactNode;
  // Positioning/sizing only (margin, width, rounding) -- background, text
  // color, and the backdrop are owned by this component.
  className?: string;
}

export function Modal({ dialogRef, children, className = "" }: ModalProps) {
  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={`relative bg-surface text-ink backdrop:bg-black/60 ${className}`}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 flex items-center justify-center min-h-11 min-w-11 rounded-full border border-ink-muted/20 bg-surface text-ink-muted shadow-md hover:text-ink text-2xl leading-none"
      >
        &times;
      </button>
      <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}
