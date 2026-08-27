// The MVP (phase 1) implementation of the checked-state seam described in
// docs/plan.md — localStorage today, a REST API behind the same two
// function signatures later. Callers (CheckedContext.tsx) never touch
// localStorage directly, so swapping phases only means changing what's
// inside these two functions, not their call sites.

const CHECKED_STORAGE_PREFIX = "bingo:checked";

function storageKey(tripSlug: string, person: string): string {
  return `${CHECKED_STORAGE_PREFIX}:${tripSlug}:${person}`;
}

export async function getChecked(
  tripSlug: string,
  person: string
): Promise<Record<string, boolean>> {
  const raw = localStorage.getItem(storageKey(tripSlug, person));
  return raw ? JSON.parse(raw) : {};
}

export async function setChecked(
  tripSlug: string,
  person: string,
  cellId: string,
  value: boolean
): Promise<Record<string, boolean>> {
  const current = await getChecked(tripSlug, person);
  const updated = { ...current, [cellId]: value };
  localStorage.setItem(storageKey(tripSlug, person), JSON.stringify(updated));
  return updated;
}
