import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AppBar } from "../components/AppBar";
import { PersonMenu } from "../components/PersonMenu";
import { Grid } from "../components/Grid";
import { CheckedProvider } from "../context/CheckedContext";
import { QueueStatus } from "../components/QueueStatus";
import { loadTrip } from "../lib/trips";
import type { LoadedTrip } from "../../types/trip";

const TINTS_ENABLED_STORAGE_KEY = "bingo:tintsEnabled";

function readStoredTintsEnabled(): boolean {
  return localStorage.getItem(TINTS_ENABLED_STORAGE_KEY) !== "false";
}

export function TripPage() {
  const { slug } = useParams<{ slug: string }>();
  const [trip, setTrip] = useState<LoadedTrip | null | undefined>(undefined); // undefined = loading, null = not found
  const [tintsEnabled, setTintsEnabled] = useState<boolean>(readStoredTintsEnabled);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setTrip(undefined);
    loadTrip(slug).then((result) => {
      if (!cancelled) setTrip(result);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    localStorage.setItem(TINTS_ENABLED_STORAGE_KEY, String(tintsEnabled));
  }, [tintsEnabled]);

  if (!slug) return null;
  if (trip === undefined) return <p>Loading…</p>;
  if (trip === null) return <p>No trip found for &quot;{slug}&quot;.</p>;

  const { grids, people, title, version } = trip;
  return (
    <CheckedProvider tripSlug={slug} version={version}>
      <AppBar title={title} onOpenMenu={() => menuRef.current?.showModal()} />
      <QueueStatus />
      <PersonMenu
        people={people}
        tintsEnabled={tintsEnabled}
        onTintsChange={setTintsEnabled}
        dialogRef={menuRef}
      />
      {/* pb-[4.25rem]: QueueStatus is `fixed bottom-4` (1rem gap) and floats
          over whatever's beneath it -- without this, scrolling to the
          actual bottom of the content leaves the toast sitting on top of
          the last card instead of clear space. 4.25rem = the toast's own
          height (py-2's 1rem + text-sm's 1.25rem line-height = 2.25rem)
          plus 2x its bottom-4 gap (2rem), so there's room to scroll the
          last bit of real content clear of it. Recompute if QueueStatus's
          padding/text size or bottom-4 offset ever changes. */}
      <ul className="flex flex-wrap justify-center text-ink pb-[4.25rem]">
        {grids.map((grid, index) => (
          <li
            key={people[index]}
            id={people[index]}
            className="relative min-w-0 max-w-full bg-surface m-1 md:m-8 list-none rounded-[1.5rem] text-center"
          >
            {/* Sticky within this card only (see AppBar.tsx's h-16) — as the page scrolls,
                each person's name label docks under the app bar and is replaced by the next
                card's label once this card scrolls past, giving "whose grid am I on" for
                free instead of tracking it with an IntersectionObserver. */}
            <div className="sticky top-16 z-10 bg-background">
              <div className="bg-surface rounded-t-[1.5rem] px-2 md:px-8 py-2 md:py-3 border-b border-ink-muted/20">
                <h2 className="text-2xl font-bold">{people[index]}&apos;s grid</h2>
              </div>
            </div>
            <div className="max-w-full overflow-x-auto p-1 md:p-8 pt-2 md:pt-4">
              <Grid grid={grid} person={people[index]} tintsEnabled={tintsEnabled} />
            </div>
          </li>
        ))}
      </ul>
    </CheckedProvider>
  );
}
