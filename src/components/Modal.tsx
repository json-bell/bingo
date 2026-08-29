import type { ReactNode, RefObject } from "react";

// Shared <dialog> shell -- see docs/future-features-draft-20260829.md's shared
// decision #1. Everything a consumer passes as children scrolls together as
// one body; the only thing that stays put regardless of scroll position is
// the close button this component renders itself, flush in the top-right
// corner (top-0 right-0). Its own border gives it contrast over whatever's
// scrolling underneath, and that same shape is its (larger, more
// distinctive) touch target -- there's no separate header slot to pass.
// `rounded-[inherit]` makes all four of the button's own corners pick up
// whatever radius the consumer gave the dialog itself via `className`
// (rounded-lg, rounded-t-3xl, ...) automatically, including across
// responsive variants, without Modal needing a radius prop duplicating
// that value -- a uniform, balanced look rather than just matching the
// one true flush (top-right) corner.
//
// Deliberately no `relative` (or any `position`) class on the <dialog>
// itself: dialog:modal already gets `position: fixed` from the browser's
// own UA stylesheet, which is both what pins it to the viewport (keeping
// the page behind it from scrolling) and already a valid positioning
// context for the absolutely-positioned close button below -- adding
// `relative` doesn't add anything, and author-origin CSS overriding that
// UA `fixed` value is exactly what silently broke the background scroll
// lock once already. Same class of gotcha as the `open:`/display one
// documented in CLAUDE.md, just for `position` instead of `display`.
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
      className={`bg-surface text-ink backdrop:bg-black/60 ${className}`}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute top-0 right-0 z-10 flex h-12 w-12 items-center justify-center rounded-[inherit] border border-ink-muted/25 bg-surface p-3 text-ink-muted hover:text-ink text-[28px] leading-none"
      >
        &times;
      </button>
      <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}
