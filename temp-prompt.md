<!--
WORKING DOC for the disney-2026 seeding priority — NOT the usual single-use
handoff. Carries implementation-tracking state across sessions until this
effort is actually implemented (design is now decided — see below).

For general project context, read CLAUDE.md, .claude/rules/architecture.md,
docs/backend-architecture.md, and docs/plan.md.
-->

# disney-2026: design decided, implementation not started

**The architecture/data-structure design is fully decided — see
`docs/grid-content-pipeline.md`, not this file, for all of it**: the TS-array
format decision, the new `BingoItem` fields (`guaranteed`, `eligiblePeople`,
`variantGroup`), the `SeedingInputs` placeholder-resolution model, the
cross-grid song-assignment script pattern, mutually-exclusive variant groups,
person-eligibility, guaranteed-item positioning, and the two rejection-
sampling passes (per-grid positioning, cross-grid balance).

`csv-grid-pipeline-notes.md` (same directory) is still accurate as a
description of the **existing** europapark-2024 CSV pipeline, which isn't
being touched — that file isn't superseded, it's just describing a different
(untouched) trip's pipeline than the one `docs/grid-content-pipeline.md`
covers.

This file now only tracks what's still open before disney-2026 is real.

## What's actually left

1. **Real event content**: draft-ideas.md (repo root) is the current draft
   event list — titles/descriptions mostly there, difficulties not yet
   assigned. Needs finishing, including deciding real `variantGroup`
   memberships, `eligiblePeople` lists, and `guaranteed` flags per the design
   in `docs/grid-content-pipeline.md` §2, §5–§7.
2. **Implementation**: none of `docs/grid-content-pipeline.md`'s design is
   built yet — new `BingoItem`/`SeedingInputs` types, the `makeGrid()`
   changes (shuffle-and-validate-on-pop, guaranteed pre-seeding, positioning
   rejection-sampling, cross-grid balance rejection-sampling), and the
   `data/disney-2026/scripts/` song-assignment script.
3. **Multi-slug end-to-end exercise** — this repo has only ever had one live
   trip. Before disney-2026 goes live, exercise two `grids/<slug>/` dirs, two
   `config/trips.json` entries, `checked` rows for two slugs at once, `/`
   listing both, and the service worker's per-slug `trip-data/` runtime
   caching all working simultaneously — ideally with throwaway fake-data
   slugs first, per the original plan, before real disney-2026 content goes
   in.
4. **People list confirmation** for disney-2026 — draft-ideas.md lists Ben,
   Ciara, James, Jason, Maria, Sarah, Thomas; confirm this is final before
   wiring `people.ts`.

## Explicitly deferred (not blocking, just parked)

- **Deeper drinker-balance stretch goal** (generate-then-rebalance for an
  even Ben/Jason split) — v1 is uniform-per-cell sampling; revisit only if
  manual adjustment proves annoying in practice.
- **"Team" grid** — a hand-authored, shared, group-wide grid rendered
  alongside the per-person ones. Fully described below; not started, not
  designed against the new `SeedingInputs`/rejection-sampling pipeline yet
  either — would need reconciling with §7/§9 of `docs/grid-content-pipeline.md`
  once picked up.

## 2nd PRIORITY (deferred): a "Team" grid

New idea from the user, explicitly **not** to be worked on now — parked here
so it isn't lost, to pick up once disney-2026 seeding is actually landed.

**What it is**: one additional grid, hand-authored rather than drawn from the
random pool at all — "seeding isn't as relevant" for it, per the user. Holds
SHARED bingo items (team/group-wide events, as opposed to any one
individual's). Appears **alongside the per-person grids, at the top** of the
trip page.

**Open, explicitly-deferred implementation-shape question**: whether "Team"
becomes just another entry in the `people: string[]` array (reusing today's
exact `grids[i] ↔ people[i]` parallel-array rendering in `TripPage.tsx`/
`seedGrid.ts` for free, with "Team" as a synthetic person name) or needs to
be a structurally distinct field (e.g. a separate `teamGrid` on
`LoadedTrip`/`TripConfig`, rendered with its own special-cased `<li>` before
the `grids.map(...)` loop). The user is explicitly open either way —
"whatever is easiest in the long term." Worth noting: if it does just become
a `people[]` entry, it would need to sort/render first (today's
`people`/`grids` order is whatever `people.ts` lists, with no existing "pin
to top" concept anywhere in `TripPage.tsx`'s rendering).

**The sequencing constraint — the important, concrete part**: the user wants
the Team grid's hand-authored cells added to the grid JSON **after grid
generation (`getGrids()`/the file write) but before DB seeding
(`seedGrid()`)** — specifically so the Team grid's cells still get real
`checked` rows inserted (tripSlug + gridVersion + cellId + person) and are
trackable/toggleable through the exact same checked-state API as everyone
else's cells, rather than needing a separate bolted-on mechanism.

This has a real, non-obvious implication for the `make-grid` CLI's current
shape: `createGrids.ts` today writes the grid file **and immediately
attempts to seed it in the same run** — there's currently no pause between
"file written" and "DB seeded" for a human to manually edit the JSON in
between. Two ways this could go (**not decided — just naming the shapes**):

- Lean on the **already-existing** `npm run seed-grid -- <slug> <version>`
  CLI (today: the failed-seed retry path) as the *intentional* manual-edit
  injection point too: run `make-grid` normally, skip/decline its auto-seed
  step, hand-edit the JSON to splice in the Team grid's cells, then run
  `seed-grid` explicitly once the edit is done. Confirmed safe: `checked`
  (`db/schema.ts`) has no content columns at all — just `cellId` (PK),
  `checked`, `updatedAt`, `tripSlug`, `gridVersion`, `person` — so
  hand-editing the JSON to splice in new, unique `cellId`s and re-running
  `seed-grid` is unambiguously safe (new ids insert, pre-existing ones are
  silently skipped since `onConflictDoNothing()` has nothing to update
  anyway).
- Or: build an explicit, separate "splice hand-authored Team cells into an
  already-written grid file" script meant to run in that gap.

Nothing here is decided or started.
