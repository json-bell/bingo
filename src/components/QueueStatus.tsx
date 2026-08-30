import { useEffect, useRef, useState } from "react";
import { useChecked } from "../context/CheckedContext";
import { formatSyncTime } from "../lib/formatSyncTime";
import { SUCCESS_FLASH_MS, SUCCESS_HOLD_MS } from "./queueStatusTiming";

// Replaces both periodic polling and a manual "Resync" button (see
// docs/backend-architecture.md §9): if something's stuck, the user sees it
// here, and the obvious response -- reload -- is itself one of the three
// drain triggers, so nothing else is needed. The count is derived from the
// queue's actual size wherever it's read, never tracked as an independent
// counter that could drift.
export function QueueStatus() {
  const { queuedCount, isSending, lastSyncedAt, syncFailed } = useChecked();
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
    const removeTimeout = setTimeout(
      () => setShowSuccess(false),
      SUCCESS_FLASH_MS
    );
    return () => {
      cancelAnimationFrame(fadeFrame);
      clearTimeout(removeTimeout);
    };
  }, [queuedCount]);

  // Also require queuedCount === 0 here, not just showSuccess: if a new
  // write gets queued while the flash is still showing (before its own
  // timer clears it), the pill needs to reflect that immediately rather
  // than keep claiming everything's synced until the stale timer fires.
  if (showSuccess && queuedCount === 0) {
    return (
      <div
        // Tailwind scans source files for complete, static class strings at
        // build time -- it never evaluates JS, so a template-literal class
        // like `duration-${SUCCESS_FLASH_MS}` is never recognized as a real
        // utility and generates no CSS at all (the fade would just snap
        // instantly instead of animating). A value that has to stay in
        // sync with a JS constant belongs in an inline style instead.
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-surface text-ink px-4 py-2 text-sm font-semibold shadow-lg transition-opacity ease-out ${fading ? "opacity-0" : "opacity-100"}`}
        style={{
          transitionDelay: `${SUCCESS_HOLD_MS}ms`,
          transitionDuration: `${SUCCESS_FLASH_MS - SUCCESS_HOLD_MS}ms`,
        }}
      >
        <span aria-hidden="true" className="text-difficulty-easy">
          ✓
        </span>
        All synced :D
      </div>
    );
  }

  // Queue is empty and nothing's mid-flight -- if the checked-state GET
  // itself is the thing that's currently failed (separate from the PATCH
  // queue above), surface that instead of going silent.
  if (queuedCount === 0) {
    if (!syncFailed) return null;
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-surface text-ink px-4 py-2 text-sm font-semibold shadow-lg">
        <span aria-hidden="true">⚠️</span>
        {lastSyncedAt ? `Last connected ${formatSyncTime(lastSyncedAt)}` : "Not yet connected"}
      </div>
    );
  }

  const updateWord = queuedCount === 1 ? "update" : "updates";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-surface text-ink px-4 py-2 text-sm font-semibold shadow-lg">
      <span aria-hidden="true">{isSending ? "⏳" : "📡"}</span>
      {isSending
        ? `${queuedCount} ${updateWord} sending…`
        : `${queuedCount} ${updateWord} queued, no connection`}
    </div>
  );
}
