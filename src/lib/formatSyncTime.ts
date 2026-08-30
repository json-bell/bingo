// Short, relative-day-aware timestamp for the "last connected" status -- e.g.
// "3:12pm, today" / "9:34pm, yesterday" / "3:12pm, 3 days ago". Shared by
// QueueStatus.tsx and the Sync Info modal so the two never drift in format.

function formatClock(date: Date): string {
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const suffix = date.getHours() >= 12 ? "pm" : "am";
  const hours = date.getHours() % 12 || 12;
  return `${hours}:${minutes}${suffix}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatSyncTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const clock = formatClock(date);
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (dayDiff <= 0) return `${clock}, today`;
  if (dayDiff === 1) return `${clock}, yesterday`;
  return `${clock}, ${dayDiff} days ago`;
}
