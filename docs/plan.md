# Offline caching & checked-state plan

Why this exists: the app gets used while walking around a venue with unreliable wifi.
Grid content is effectively locked in the moment you leave home, but a future per-cell
"checked" state is expected to change throughout the day — those two kinds of data need
different treatment (caching *and* storage), and this doc is where that split is decided
and tracked as the checked-state feature evolves through its phases.

**Status: all phases below are now implemented.** This doc is kept as the historical record
of the original thinking — the actual final shape (which refined some details below, notably
dropping `person` from the seam's signature in favor of a globally-unique `cellId`, and adding
`version`/basis-timestamp optimistic concurrency this doc's phase 3 sketch didn't anticipate)
is `docs/backend-architecture.md`, which explicitly supersedes the "Future SQL migration
shape" and "Checked-state roadmap" phases 2/3 sections below.

## Current state (implemented)

Offline support for the app shell, trip data, and checked-state is live via `vite-plugin-pwa`
(`vite.config.ts`), split into three independent lanes (a third, `NetworkFirst`, lane for the
checked-state `GET` was added once that API existed — see `docs/backend-architecture.md` §9;
the two below are unchanged from when this section was first written):

**App shell** (`index.html`, hashed JS/CSS) — precached at build time by Workbox's
default `generateSW` mode, with `navigateFallback: "/index.html"` so any client-side
route (`/europapark-2024`, `/disney-2026`, ...) still resolves offline. Updates
propagate automatically (`registerType: "autoUpdate"`) — an online visit picks up a
new deploy within a reload or two; no manual "update available" prompt.

**Trip data** (`grids/<slug>/<n>.json`, `data/<slug>/people.ts`) — deliberately
*not* precached. These are lazy-loaded via `import.meta.glob` in `src/lib/trips.ts`
and bundled as ordinary JS chunks, so there's no ".json" URL to distinguish them from
app-shell code by pattern alone. `vite.config.ts`'s `chunkFileNames` routes them into
their own `trip-data/` output directory instead, purely so Workbox's `runtimeCaching`
can target that URL space with a `CacheFirst` rule — meaning only the trip(s) a
visitor actually opens get cached, not every trip in the repo. This is correct (not
just convenient) because a grid version is never overwritten — promoting a new one
(`make-grid`) writes a new numbered file, so a given `trip-data/` URL's content can
never go stale once cached.

Verified end-to-end: register the service worker, go fully offline (no network
throttling — actually disconnected), hard-reload the page, full grid renders.

## Checked-state roadmap

**Phase 1 (MVP, localStorage — superseded)**: `src/lib/checked.ts` (the seam) +
`src/context/CheckedContext.tsx` (`CheckedProvider`/`useChecked`), wired into `TripPage.tsx` →
`Grid.tsx` → `Tile.tsx`. The toggle itself lives **inside each cell's modal**
(next to its full description), not as a separate control on the tile — the tile
stays a single click target that opens the modal, and just reflects checked state
passively (dimmed, struck-through text) once it's been marked — this part is still true.
**Phases 2/3 below are now implemented too**, in refined form — see
`docs/backend-architecture.md` §4 (the API) and §9 (the frontend integration, including the
offline queue that replaced this section's "FIFO outbox" sketch with a cell-id-keyed queue
instead, and three specific drain triggers rather than "the manual Refresh button or
`online`").

Settled on **"Checked"** as the terminology (not "tick") — `isChecked`, `useChecked`,
`CheckedProvider`, `setChecked`.

Three phases, each meant to be a drop-in replacement for the last behind one seam —
not a rewrite of call sites:

```ts
getChecked(tripSlug: string, person: string): Promise<Record<string, boolean>>
setChecked(tripSlug: string, person: string, cellId: string, value: boolean): Promise<Record<string, boolean>>
```

Both return Promises *even in the localStorage phase*, even though that phase's
underlying read/write is synchronous — so `TripPage.tsx`/`Tile.tsx` call the same
shape in all three phases, and only what's *behind* the seam changes.

1. **MVP (localStorage, per-device)** — synchronous reads/writes, keyed per
   trip+person (e.g. `bingo:checked:<tripSlug>:<person>`). No network involved, so
   nothing to cache and no offline concern at all. Each device/person tracks their own
   progress independently — no shared state, no conflicts.
2. **Shared REST API, online-only writes** — `getChecked` becomes a GET (manually
   triggered via a Refresh button, not polling — no websocket/real-time push is
   planned); `setChecked` becomes a PATCH, attempted only when online. The PATCH
   response returns the grid's full latest checked state, so a successful check never
   needs a follow-up GET. If the PATCH fails (offline), the UI falls back to whatever's
   already displayed.
3. **Offline-queued writes (final)** — layer a small FIFO outbox behind `setChecked`:
   the UI updates optimistically and the call is appended to a pending queue
   (localStorage or IndexedDB) instead of failing outright when offline; a
   `window.addEventListener("online", ...)` handler (or the manual Refresh button)
   drains the queue by replaying each PATCH in order. Conflict resolution is
   deliberately not a concern here — a check is an idempotent boolean *set*, not an
   increment, so replay order and staleness don't produce inconsistent results the way
   a counter or list-append would.

None of this needs a websocket or real-time sync layer at any phase — manual Refresh
(GET) plus PATCH-returns-latest-state covers the stated requirements.

### Where the seam lives: a single `CheckedProvider`

`TripPage.tsx` renders *every* person's grid on one page at once — not just "your
own" — so the seam is a single React Context (`CheckedProvider`), mounted once per
trip page, holding the whole trip's checked-state map (all people, all cells) rather
than one hook instance per person. It reads from localStorage exactly once on init and
exposes one `updateChecked(person, cellId, value)` down through `Grid` → `Tile`
via `useContext`. This is the one place phase 2/3's REST PATCH + offline queue
eventually gets built — a single call site to modify, not one per component instance.

## Cell IDs

Cells have no stable identifier today — `BingoItem`'s fields (`type`, `difficulty`,
`summary`, `description`) are either not unique (`type` is a free-text CSV category
like `"park"`/`"life"`, shared across many cells) or only incidentally unique within
one generated grid. `setChecked`/`getChecked` need a real one to key off.

**Decision: assign a UUID per cell at grid-generation time** (`crypto.randomUUID()`,
built into Node — no new dependency), in `makeGrid()` in `data/getGrids.ts`. This
mirrors exactly what a SQL database would do automatically at `INSERT` time — the
generation step *is* this app's insert moment — so the placed-cell type (`GridCell`,
distinct from the template `BingoItem`) carries a required `id: string` in
`types/trip.ts`, and there's no separate "assign IDs" step to keep in
sync later.

The ID is a **globally unique, purely opaque join-key** — it carries no positional
meaning (no row/col, no significance beyond "this exact cell"). Position (which row,
which column) lives entirely in the static grid JSON's array nesting, exactly as
today, and never needs to travel through the checked-state API at all — the client
already has the full grid loaded and just needs, per cell it's rendering, "is this
`cellId` checked?"

**Backfill, not regenerate (done)**: `grids/europapark-2024/1.json` predated this and
had no IDs, and `makeGrid()` is randomized (no seed), so regenerating from the CSV
would have reshuffled everyone's actual grid layout, not just added a field. Instead,
`data/backfillCellIds.ts` (a one-off, but kept around in case another already-live
grid ever needs the same treatment) read `1.json` verbatim, added
`id: crypto.randomUUID()` to every cell in place, and wrote the result as `2.json` per
the existing never-overwrite convention; `config/trips.json`'s `currentVersion` is now
`2`. Content and layout are unchanged from `1.json` — only the new field was added
(verified programmatically before promoting). `makeGrid()` in `data/getGrids.ts` now
also assigns an id to every cell it places, so this is a one-time catch-up, not an
ongoing step.

## Future SQL migration shape (not being built now)

Not prioritized — the MVP is localStorage, then real persistence is the REST API
described above. This section exists so the ID design and phase-1 implementation
don't have to be redone when that day comes.

**Grid content does not need to move into a database.** It's immutable once
generated and already well-served as static, cacheable files (see "Current state"
above) — there's no upgrade pressure on it. **Only checked state is actually
dynamic**, so that's the only thing that needs a real backend table:

```sql
CREATE TABLE checked_cells (
  cell_id       TEXT PRIMARY KEY,   -- the UUID assigned at grid-generation time
  trip_slug     TEXT NOT NULL,
  grid_version  INT NOT NULL,
  person        TEXT NOT NULL,
  checked       BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON checked_cells (trip_slug, grid_version, person);
```

- `GET /trips/:tripSlug/:version/:person/checked` → filter by those three columns,
  return `{cellId: checked}`.
- `PATCH /trips/:tripSlug/:version/:person/checked/:cellId` → update one row, return
  the fresh full map.
- Seeding: whenever a grid's generated/promoted, one insert per cell (25 × N people)
  sets up rows with `checked: false` — the "POST from my machine" step, not a concern
  for client-side caching.

**Why relational, not a document/NoSQL store**: this data is a flat table with a
handful of scalar columns — the case relational databases are built for. A document
store earns its keep when data is nested/variable-shaped, which this isn't (that
would only matter if grid *content*, which is naturally nested, ever moved into the
database — see above for why it doesn't need to). A key-value store (Redis-style) is
a legitimate simpler alternative given the data really is just `cellId → boolean`, but
loses easy indexed filtering by `tripSlug`/`version`/`person`. **GraphQL isn't a
storage choice at all** — it's a query/API layer that could sit in front of either;
a 2-endpoint surface (GET a map, PATCH one cell) doesn't need a query language, it
needs two routes.

**Why `cell_id` as a bare opaque string extends painlessly**: it's already a stable,
globally-unique value assigned once at generation time, so nothing about adding more
structure later ever needs to remap it. If `people`/`grid_versions`/grid content ever
did become real tables:

```sql
trips (trip_slug TEXT PRIMARY KEY, title TEXT)

grid_versions (
  id SERIAL PRIMARY KEY,
  trip_slug TEXT REFERENCES trips(trip_slug),
  version INT,
  UNIQUE(trip_slug, version)
)

people (
  id SERIAL PRIMARY KEY,
  grid_version_id INT REFERENCES grid_versions(id),
  name TEXT
)

cells (
  id TEXT PRIMARY KEY,   -- same UUID, unchanged from day one
  person_id INT REFERENCES people(id),
  row INT, col INT, type TEXT, difficulty TEXT, summary TEXT, description TEXT
)
```

`checked_cells.cell_id` would go from "an opaque string with no backing table" to a
real foreign key into `cells.id` — no rename, no data migration. The denormalized
`trip_slug`/`grid_version`/`person` columns already on `checked_cells` become
*optional* at that point (joinable via `cell_id → cells.person_id →
people.grid_version_id → grid_versions.trip_slug/version`), not something that must be
ripped out. This whole tier is only needed if grid content itself ever moves into the
database — if it never does, `checked_cells` stays exactly as sketched above,
indefinitely, and that's a fine permanent state, not an unfinished one.

*(Aside, not part of this plan: today's static-file system already has an analogous
un-enforced positional link — `grids[i]` corresponds to `people[i]` in
`data/<slug>/people.ts` purely by array index, with nothing checking the two stay in
sync. Pre-existing property of the current design, not introduced by any of the above.)*

## Open considerations

- Phase 1's localStorage implementation is explicitly allowed to be thrown away
  rather than "upgraded in place" if that's cheaper than generalizing it — the
  `getChecked`/`setChecked` seam is what's meant to survive, not necessarily the MVP's
  internals.
- The backend/API shape above is a sketch, not a commitment — deferred until phase 2
  is actually being built, and not currently prioritized (localStorage MVP first).
- Multi-device *shared* (not per-device) checked state was considered and explicitly
  ruled out for now — would need real conflict resolution and is a materially bigger
  build than anything above.
