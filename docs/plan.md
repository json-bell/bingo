# Offline caching & tick-state plan

Why this exists: the app gets used while walking around a venue with unreliable wifi.
Grid content is effectively locked in the moment you leave home, but a future
per-cell "ticked" state is expected to change throughout the day — those two kinds of
data need different caching treatment, and this doc is where that split is decided and
tracked as the tick-state feature evolves through its phases.

## Current state (implemented)

Offline support for the app shell and trip data is live via `vite-plugin-pwa`
(`vite.config.ts`), split into two independent lanes:

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
can target that URL space with a `CacheFirst` rule — meaning only the slug(s) a
visitor actually opens get cached, not every trip in the repo. This is correct (not
just convenient) because a grid version is never overwritten — promoting a new one
(`make-grid`) writes a new numbered file, so a given `trip-data/` URL's content can
never go stale once cached.

Verified end-to-end: register the service worker, go fully offline (no network
throttling — actually disconnected), hard-reload the page, full grid renders.

## Tick-state roadmap (not yet built)

Three phases, each meant to be a drop-in replacement for the last behind one
function-shaped seam — not a rewrite:

```ts
getTicks(slug: string, person: string): Promise<Record<string, boolean>>
setTick(slug: string, person: string, cellId: string, value: boolean): Promise<Record<string, boolean>>
```

`BingoItem.tsx`/`TripPage.tsx` only ever call these two functions — never `fetch`,
`localStorage`, or a queue directly. Swapping phases means changing what's behind the
seam, not the call sites.

1. **MVP (localStorage, per-device)** — synchronous reads/writes, keyed per
   trip+person+grid (e.g. `bingo:ticks:<slug>:<person>`). No network involved, so
   nothing to cache and no offline concern at all. Each device/person tracks their
   own progress independently — no shared state, no conflicts.
2. **Shared REST API, online-only writes** — `getTicks` becomes a GET (manually
   triggered via a Refresh button, not polling — no websocket/real-time push is
   planned); `setTick` becomes a PATCH, attempted only when online. The PATCH
   response returns the grid's full latest tick state, so a successful tick never
   needs a follow-up GET. If the PATCH fails (offline), the UI falls back to
   whatever's already displayed.
3. **Offline-queued writes (final)** — layer a small FIFO outbox behind `setTick`:
   the UI updates optimistically and the call is appended to a pending queue
   (localStorage or IndexedDB) instead of failing outright when offline; a
   `window.addEventListener("online", ...)` handler (or the manual Refresh button)
   drains the queue by replaying each PATCH in order. Conflict resolution is
   deliberately not a concern here — a tick is an idempotent boolean *set*, not an
   increment, so replay order and staleness don't produce inconsistent results the
   way a counter or list-append would.

None of this needs a websocket or real-time sync layer at any phase — manual
Refresh (GET) plus PATCH-returns-latest-state covers the stated requirements.

## Open considerations

- Phase 1's localStorage implementation is explicitly allowed to be thrown away
  rather than "upgraded in place" if that's cheaper than generalizing it — the
  `getTicks`/`setTick` seam is what's meant to survive, not necessarily the MVP's
  internals.
- The backend/API shape (REST endpoint paths, auth if any) isn't designed yet —
  deferred until phase 2 is actually being built.
- Multi-device *shared* (not per-device) tick state was considered and explicitly
  ruled out for now — would need real conflict resolution and is a materially bigger
  build than anything above.
