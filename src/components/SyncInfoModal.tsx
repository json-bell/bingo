import type { RefObject } from "react";
import { Modal } from "./Modal";
import { formatSyncTime } from "../lib/formatSyncTime";
import { useChecked } from "../context/CheckedContext";
import type { QueuedWrite } from "../lib/checkedQueue";

// cellId -> where it lives, so the queue's flat, id-keyed entries can be
// grouped and labelled the way the future-features doc asks for ("Organised
// by Name > turning On/Off > displaying the title"). Built once in
// TripPage.tsx from the grids it already has, not re-derived here.
export type CellLookup = Record<string, { person: string; summary: string }>;

interface SyncInfoModalProps {
  cellLookup: CellLookup;
  people: string[];
  dialogRef: RefObject<HTMLDialogElement>;
}

function groupByPerson(writes: QueuedWrite[], cellLookup: CellLookup): Map<string, QueuedWrite[]> {
  const groups = new Map<string, QueuedWrite[]>();
  for (const write of writes) {
    const person = cellLookup[write.cellId]?.person;
    if (!person) continue; // stale/unknown cell id -- nothing sensible to label it with
    const existing = groups.get(person);
    if (existing) {
      existing.push(write);
    } else {
      groups.set(person, [write]);
    }
  }
  return groups;
}

export function SyncInfoModal({ cellLookup, people, dialogRef }: SyncInfoModalProps) {
  const { lastSyncedAt, syncFailed, queuedCount, queuedWrites, isSending, removeQueued } = useChecked();
  const grouped = groupByPerson(queuedWrites, cellLookup);

  return (
    <Modal
      dialogRef={dialogRef}
      className="m-auto w-full max-w-md rounded-[var(--modal-radius)] [--modal-radius:1rem]"
    >
      <h2 className="text-lg font-bold mb-4">Synchronisation info</h2>

      <p className="text-sm">
        {syncFailed
          ? lastSyncedAt
            ? `Last connected ${formatSyncTime(lastSyncedAt)}`
            : "Not yet connected"
          : "Up to date ✓"}
      </p>

      <div className="border-t border-ink-muted/20 mt-4 pt-4">
        <p className="text-sm text-ink-muted mb-3">
          {queuedCount === 0
            ? "No updates waiting"
            : `${queuedCount} update${queuedCount === 1 ? "" : "s"} waiting`}
        </p>

        {queuedCount > 0 && (
          <ul className="flex flex-col gap-4">
            {people
              .filter((person) => grouped.has(person))
              .map((person) => (
                <li key={person}>
                  <p className="font-semibold text-sm mb-2">{person}</p>
                  <ul className="flex flex-col gap-2">
                    {grouped.get(person)!.map((write) => (
                      <li
                        key={write.cellId}
                        className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm"
                      >
                        <span>
                          {write.checked ? "Completed" : "Incomplete"}:{" "}
                          {cellLookup[write.cellId]?.summary ?? write.cellId}
                        </span>
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => removeQueued(write.cellId)}
                          className="shrink-0 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
