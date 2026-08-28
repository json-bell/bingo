import { useChecked } from "../context/CheckedContext";

// Replaces both periodic polling and a manual "Resync" button (see
// docs/backend-architecture.md §9): if something's stuck, the user sees it
// here, and the obvious response -- reload -- is itself one of the three
// drain triggers, so nothing else is needed. The count is derived from the
// queue's actual size wherever it's read, never tracked as an independent
// counter that could drift.
export function QueueStatus() {
  const { queuedCount } = useChecked();
  if (queuedCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-surface text-ink px-4 py-2 text-sm font-semibold shadow-lg">
      <span aria-hidden="true">⏳</span>
      {queuedCount} update{queuedCount === 1 ? "" : "s"} queued…
    </div>
  );
}
