# Test plan

Goal: a few, high-value tests — not a comprehensive "every component" suite. Prefer either
end-to-end flows through real code with minimal mocking, or targeted unit tests of actual
data-management logic. Don't test what React/the framework already guarantees, and don't
test presentational components that have no real logic in them.

## Tooling: Vitest (implemented)

`src/lib/trips.ts`'s `loadTrip`/`listSlugs` — the most important data-flow code to cover —
is built on `import.meta.glob`, a Vite-only compile-time macro (not a real JS API, so a
test runner needs to understand it natively rather than transform around it). Vitest is
built on Vite itself, understands `import.meta.glob` natively, and shares the project's
existing `vite.config.ts`/TypeScript setup, which is exactly what makes testing that file
against real fixture data possible without mocking its loading mechanism.

Config lives in `vite.config.ts`'s `test` field (import `defineConfig` from
`"vitest/config"`, not plain `"vite"`, to get that field typed) plus `vitest.setup.ts`
(registered via `setupFiles`). `vitest.setup.ts` is included by `tsconfig.app.json`, not
`tsconfig.node.json` — it needs DOM lib types (it patches `HTMLDialogElement.prototype`),
same reason `data/*.test.ts` files (Node-context, no DOM) and `src/**/*.test.tsx` files
(jsdom-context) sit under different tsconfig projects already.

Two real gotchas hit while setting this up, both already fixed — see `CLAUDE.md`'s testing
paragraph for the short version:
- jsdom implements `HTMLDialogElement` as a real class (elements really are instances of
  it) but doesn't implement `showModal()`/`close()` at all — not a missing element, just
  two missing methods. `vitest.setup.ts` polyfills both by toggling the `open` attribute.
- Vite's dynamic `import()` needs a statically-analyzable specifier; a fully
  runtime-variable path (e.g. importing a file just written to a disposable fixture slug)
  fails with "Unknown variable dynamic import" even with `await import()`. Read the
  written file's source directly and parse out what's needed instead of importing it as a
  module — see `data/generateDataFile.test.ts`.

## Short-term: what to test now (implemented)

Five targets, in priority order:

1. **`data/getGrids.ts`** (`makeGrid`/`getGrids`) — the core generation logic. Pure
   function, real data in/out, no mocking needed. Assert: every grid is 5×5 with the
   difficulty layout `difficultyKey` specifies; every cell gets a unique `id`; no event
   repeats within one grid; supplying too few events for a difficulty still throws the
   "ran out of events" error (regression guard — this is the exact bug the strict-mode
   TypeScript migration caught via `Array.prototype.pop()` returning `T | undefined`, and
   it would be easy to silently reintroduce); hug/fistbump cells get a character name
   appended to their description.
2. **`data/generateDataFile.ts`** — the hand-rolled CSV-splitting logic (`SPLITHERE`,
   `,,,\r\n` markers) has no test coverage today. One test against a small known CSV
   fixture, asserting the parsed `BingoItem[]` shape.
3. **`src/lib/trips.ts`** (`loadTrip`/`listSlugs`) — run against the real
   `europapark-2024` fixture data already in the repo, not mocks. Assert
   `grids.length === people.length`, `title` matches `config/trips.json`, and
   `loadTrip("nonexistent-slug")` resolves to `null`. This is the one place a real
   end-to-end-without-mocking test is both possible and valuable, made possible by
   Vitest's native `import.meta.glob` support (see the Tooling section above).
4. **`src/lib/checked.ts`** (`getChecked`/`setChecked`) — test the *contract*, not the
   implementation: empty map when nothing's stored; a value persists and round-trips;
   sequential `setChecked` calls accumulate rather than clobber each other; two different
   `(tripSlug, person)` pairs don't leak into each other's state. Phrasing assertions
   against what these functions promise to return (rather than, say, asserting on the
   exact `localStorage` key string as the primary check) is deliberate — see "Long-term"
   below for why.
5. **One integration test through real components**: render `TripPage` for a real trip
   (`@testing-library/react`, real fixture data, no mocked context), open a tile's modal,
   toggle "Mark as checked," and assert *both* the rendered dimmed/struck-through tile
   state *and* the underlying `localStorage` value. This is the one test that would catch
   a broken wiring between `Tile` → `CheckedContext` → `checked.ts` → `localStorage`
   (e.g. a renamed prop) that the unit tests above, each testing one link in isolation,
   would miss.

### Deliberately not testing

- Presentational components (`AppBar.tsx`, `PersonMenu.tsx`, `TintToggle.tsx`) — no real
  logic, snapshotting them is maintenance cost for near-zero bug-catching value.
- `CheckedContext.tsx`'s `useContext`/`Provider` wiring in isolation — that's testing
  React itself, not our code. Its actual logic is already covered by `checked.ts`'s tests
  plus the one integration test above.
- Tailwind/visual output, the service worker/PWA config (`vite-plugin-pwa`, the
  `trip-data`/precache split in `vite.config.ts`) — not meaningfully unit-testable; that's
  what `docs/visual-verification.md`'s recipe is for instead. Concretely: a bare `flex`
  class on `Tile.tsx`'s `<dialog>` once made every tile's modal permanently visible on
  every grid (see CLAUDE.md's `<dialog>` section) — real browser-cascade behavior
  (author CSS beats the UA stylesheet's `dialog:not([open])` rule regardless of
  specificity) that jsdom's `TripPage.test.tsx` didn't catch, since every existing
  assertion only checked dialog state *after* an open/close action, never the untouched
  initial page load.
- `data/backfillCellIds.ts` — a one-off migration script, already manually verified
  (diffed programmatically before promoting), not worth ongoing coverage.

## Long-term: evolving alongside the backend

The checked-state roadmap in `docs/plan.md` has three phases; tests should evolve with
them rather than being thrown away and rewritten each time:

- **Phase 1 (now, localStorage)**: covered by target 4 above, phrased against
  `getChecked`/`setChecked`'s contract (what they return and guarantee), not
  localStorage-specific mechanics. `setChecked`/`getChecked` are already async
  (Promise-returning) even though the current implementation is synchronous under the
  hood, specifically so call sites and test assertions don't need to change shape later.
- **Phase 2 (shared REST API, online-only writes)**: this is where mocking genuinely
  becomes appropriate and necessary — real network calls have no place in a test suite.
  Reach for `msw` (Mock Service Worker) to intercept `fetch` at the network layer rather
  than mocking `getChecked`/`setChecked` themselves, so the tests still exercise the real
  function bodies (request construction, response parsing) and only the actual HTTP
  round-trip is faked. The bulk of target 4's *assertions* (empty state, round-tripping a
  value, per-person isolation) should still hold — only the setup (mock a server response
  instead of touching real `localStorage`) changes. The integration test (target 5)
  should keep working with no changes at all, since it goes through the seam, not around
  it.
- **Phase 3 (offline-queued writes)**: the FIFO outbox's replay logic (queue order,
  idempotent-boolean-set correctness — replaying an out-of-order or duplicate "set to
  true" should never produce a wrong result) becomes its own new unit-test target once
  that queue exists. This is a good candidate for the same "test the contract, not the
  mechanism" treatment: what matters is that a sequence of offline `setChecked` calls,
  replayed in any order after reconnecting, converges on the correct final state per
  cell — not the specific queue data structure used to achieve that.
- If a future backend introduces its own data store (per `docs/plan.md`'s SQL sketch),
  that's a separate service with its own test suite in its own codebase/scope — not
  something this repo's frontend test suite should reach into.
