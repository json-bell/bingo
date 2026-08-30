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
const ZOOM_TO_FILL_STORAGE_KEY = "bingo:zoomToFill";

function readStoredTintsEnabled(): boolean {
  return localStorage.getItem(TINTS_ENABLED_STORAGE_KEY) !== "false";
}

function readStoredZoomToFill(): boolean {
  return localStorage.getItem(ZOOM_TO_FILL_STORAGE_KEY) === "true";
}

export function TripPage() {
  const { slug } = useParams<{ slug: string }>();
  const [trip, setTrip] = useState<LoadedTrip | null | undefined>(undefined); // undefined = loading, null = not found
  const [tintsEnabled, setTintsEnabled] = useState<boolean>(readStoredTintsEnabled);
  const [zoomToFill, setZoomToFill] = useState<boolean>(readStoredZoomToFill);
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

  useEffect(() => {
    localStorage.setItem(ZOOM_TO_FILL_STORAGE_KEY, String(zoomToFill));
  }, [zoomToFill]);

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
        zoomToFill={zoomToFill}
        onZoomToFillChange={setZoomToFill}
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
            className={`relative min-w-0 max-w-full bg-surface list-none rounded-[1.5rem] text-center ${
              // A flex item with no explicit width sizes to its own content
              // (flex-basis: auto) -- fine normally, since the fixed-px
              // Grid's own natural size IS the content. But zoom-to-fill's
              // @container div below needs a *definite* width to scale
              // against; without one, container-type: inline-size's implied
              // containment cuts the card off from its own content's size,
              // and it collapses to some small fallback instead of tracking
              // the viewport. w-full breaks that cycle by giving the card a
              // real size to hand down.
              zoomToFill ? "w-full m-1 md:m-4" : "m-1 md:m-8"
            }`}
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
            <div
              className={`max-w-full p-1 md:p-8 pt-2 md:pt-4 ${
                zoomToFill ? "@container" : "overflow-x-auto"
              }`}
            >
              {zoomToFill ? (
                // Grid renders at its natural fixed-px size (520/1040px --
                // see the comment on the scale-[...] classes below) and is
                // then visually scaled down to fill the container, via
                // container query units so no JS/ResizeObserver is needed.
                // The aspect-square wrapper reserves the correct (scaled)
                // box in the page's normal flow -- Grid's own natural size
                // is a perfect square (5 equal square tiles, same gap in
                // both axes), so aspect-square exactly matches the shape a
                // scaled copy of it would be. transform doesn't shrink the
                // space an element reserves in flow on its own, hence
                // needing this rather than relying on Grid's own box.
                <div className="aspect-square w-full overflow-hidden">
                  <Grid
                    grid={grid}
                    person={people[index]}
                    tintsEnabled={tintsEnabled}
                    // 520px/1040px = the grid's natural unscaled width at
                    // each breakpoint (5 * 100px/200px tiles + 4 * 5px/10px
                    // gaps). 100cqw is the *container's* current width (the
                    // ancestor div above, via @container), so the ratio is
                    // exactly "how much smaller is the available space than
                    // the grid's natural size" -- CSS division of two
                    // lengths inside calc() yields a plain number, which is
                    // what scale() needs.
                    className="origin-top-left scale-[calc(100cqw/520px)] md:scale-[calc(100cqw/1040px)]"
                  />
                </div>
              ) : (
                <Grid grid={grid} person={people[index]} tintsEnabled={tintsEnabled} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </CheckedProvider>
  );
}
