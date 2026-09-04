import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AppBar } from "../components/AppBar";
import { PersonMenu } from "../components/PersonMenu";
import { Grid } from "../components/Grid";
import { CheckedProvider } from "../context/CheckedContext";
import { QueueStatus } from "../components/QueueStatus";
import { SyncInfoModal } from "../components/SyncInfoModal";
import type { CellLookup } from "../components/SyncInfoModal";
import { loadTrip } from "../lib/trips";
import { useDbStatus } from "../lib/useDbStatus";
import type { LoadedTrip } from "../../types/trip";

const TINTS_ENABLED_STORAGE_KEY = "bingo:tintsEnabled";
const ZOOM_TO_FILL_STORAGE_KEY = "bingo:zoomToFill";

function readStoredTintsEnabled(): boolean {
  return localStorage.getItem(TINTS_ENABLED_STORAGE_KEY) !== "false";
}

function readStoredZoomToFill(): boolean {
  return localStorage.getItem(ZOOM_TO_FILL_STORAGE_KEY) !== "false";
}

export function TripPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [trip, setTrip] = useState<LoadedTrip | null | undefined>(undefined); // undefined = loading, null = not found
  const [tintsEnabled, setTintsEnabled] = useState<boolean>(
    readStoredTintsEnabled
  );
  const [zoomToFill, setZoomToFill] = useState<boolean>(readStoredZoomToFill);
  const menuRef = useRef<HTMLDialogElement>(null);
  const syncInfoRef = useRef<HTMLDialogElement>(null);
  // Fired once here (not inside SyncInfoModal) so it's already in flight by
  // the time the modal is opened, rather than only starting then -- see
  // useDbStatus.ts.
  const dbStatus = useDbStatus();

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

  // A cold load straight to /<slug>#<person> (as opposed to clicking a
  // #<person> link while already on an already-rendered trip page) can't
  // rely on the browser's native one-shot scroll-to-fragment: this is a
  // client-rendered SPA, so the <li id={person}> elements below don't exist
  // in the DOM yet when the browser tries it, and most browsers don't retry
  // once they later appear. Once `trip` has actually loaded (and this
  // render has committed the real list to the DOM), do it ourselves.
  // scrollIntoView honors each <li>'s scroll-mt-16 the same way native
  // fragment navigation does, so this lands in exactly the same place a
  // same-page click would -- no separate offset math to keep in sync.
  useEffect(() => {
    if (!trip) return;
    const id = location.hash.slice(1);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [trip, location.hash]);

  useEffect(() => {
    localStorage.setItem(TINTS_ENABLED_STORAGE_KEY, String(tintsEnabled));
  }, [tintsEnabled]);

  useEffect(() => {
    localStorage.setItem(ZOOM_TO_FILL_STORAGE_KEY, String(zoomToFill));
  }, [zoomToFill]);

  // cellId -> {person, summary}, for the Sync Info modal's queue list.
  // Computed here (not inside the modal) since it's derived from data
  // TripPage already has loaded; must run before the early returns below
  // (Rules of Hooks), hence the optional chaining over a possibly-missing trip.
  const cellLookup = useMemo<CellLookup>(() => {
    const lookup: CellLookup = {};
    trip?.grids.forEach((grid, index) => {
      const person = trip.people[index];
      grid.forEach((row) => {
        row.forEach((cell) => {
          lookup[cell.id] = { person, summary: cell.summary };
        });
      });
    });
    return lookup;
  }, [trip]);

  if (!slug) return null;
  if (trip === undefined) return <p>Loading…</p>;
  if (trip === null) return <p>No trip found for &quot;{slug}&quot;.</p>;

  const { grids, people, title, version } = trip;
  return (
    <CheckedProvider tripSlug={slug} version={version}>
      <AppBar title={title} onOpenMenu={() => menuRef.current?.showModal()} />
      <QueueStatus onOpenSyncInfo={() => syncInfoRef.current?.showModal()} />
      <PersonMenu
        people={people}
        tintsEnabled={tintsEnabled}
        onTintsChange={setTintsEnabled}
        zoomToFill={zoomToFill}
        onZoomToFillChange={setZoomToFill}
        onOpenSyncInfo={() => syncInfoRef.current?.showModal()}
        dialogRef={menuRef}
      />
      <SyncInfoModal
        cellLookup={cellLookup}
        people={people}
        dbStatus={dbStatus}
        dialogRef={syncInfoRef}
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
            className={`relative min-w-0 max-w-full bg-surface list-none rounded-[1.5rem] text-center scroll-mt-16 ${
              // scroll-mt-16 matches AppBar.tsx's h-16 -- PersonMenu.tsx's
              // jump links are plain <a href="#name">, and native
              // anchor-scroll otherwise puts this <li>'s top at viewport
              // y=0, right under the fixed AppBar, landing this card's own
              // sticky (top-16) name header behind it instead of docked
              // below it.
              //
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
                <h2 className="text-2xl font-bold">
                  {people[index]}&apos;s grid
                </h2>
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
                <div className="aspect-square w-full overflow-hidden text-left">
                  {/* text-left overrides the inherited body { text-align: center }
                      for this subtree. Grid's own div is inline-grid (an inline-
                      level box, kept that way for the non-zoomed mode's shrink-
                      wrapped centering), so without this, normal layout centers
                      its *natural* pre-transform width within this wrapper before
                      the scale transform ever runs -- offsetting the scale's
                      anchor away from the wrapper's true left edge and (since
                      natural width and available width diverge across the
                      viewport range) throwing the math off by a width-dependent
                      amount. text-left keeps the box flush at x=0, matching the
                      origin-top-left assumption below. */}
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
                <Grid
                  grid={grid}
                  person={people[index]}
                  tintsEnabled={tintsEnabled}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </CheckedProvider>
  );
}
