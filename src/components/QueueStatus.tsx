import { useEffect, useRef, useState } from "react";
import { useChecked } from "../context/CheckedContext";

// How long the "0 updates queued" success confirmation stays visible after
// the last queued write settles, fading out continuously over that window
// (not held solid then faded separately) before unmounting.
const SUCCESS_FLASH_MS = 500;

// Replaces both periodic polling and a manual "Resync" button (see
// docs/backend-architecture.md §9): if something's stuck, the user sees it
// here, and the obvious response -- reload -- is itself one of the three
// drain triggers, so nothing else is needed. The count is derived from the
// queue's actual size wherever it's read, never tracked as an independent
// counter that could drift.
export function QueueStatus() {
  const { queuedCount, isSending } = useChecked();
  const previousCount = useRef(queuedCount);
  const [showSuccess, setShowSuccess] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const wasNonZero = previousCount.current > 0;
    previousCount.current = queuedCount;
    if (!wasNonZero || queuedCount !== 0) return;

    // The N>0 -> 0 transition: the last queued write just settled. Mount
    // the confirmation at full opacity first, then flip to fading on the
    // next frame -- a CSS transition only animates a value that actually
    // changes after mount, not one present from the first paint.
    setShowSuccess(true);
    setFading(false);
    const fadeFrame = requestAnimationFrame(() => setFading(true));
    const removeTimeout = setTimeout(() => setShowSuccess(false), SUCCESS_FLASH_MS);
    return () => {
      cancelAnimationFrame(fadeFrame);
      clearTimeout(removeTimeout);
    };
  }, [queuedCount]);

  if (showSuccess) {
    return (
      <div
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-surface text-ink px-4 py-2 text-sm font-semibold shadow-lg transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
      >
        <span aria-hidden="true" className="text-difficulty-easy">
          ✓
        </span>
        0 updates queued
      </div>
    );
  }

  if (queuedCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-surface text-ink px-4 py-2 text-sm font-semibold shadow-lg">
      <span aria-hidden="true">{isSending ? "⏳" : "📡"}</span>
      {isSending ? `Updating ${queuedCount}…` : `${queuedCount} queued, waiting to sync`}
    </div>
  );
}
