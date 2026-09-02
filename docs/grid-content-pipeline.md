# Templated grid content & seeding design

Why this exists: this is the durable record of the disney-2026 seeding design and how it maps
to the real code — `data/disney-2026/generateGrids.ts` (plus `bingoes.ts`, `people.ts`,
`variantGroups.ts`, `seedingInputs.ts`), merged to `main` — the `DisneyEvent` shape, the
placeholder/templating mechanism, the mutually-exclusive/eligibility/guaranteed-item rules,
and the two rejection-sampling passes. What's still genuinely unfinished (real content, the
multi-slug exercise) is tracked in "Open work" below, not a separate working doc.
`csv-grid-pipeline-notes.md` (same directory) remains an accurate description of the
**existing** europapark-2024 CSV pipeline, which is not being touched or migrated — this doc
describes the **new**, TS-array-based pipeline that disney-2026 (and any future trip) uses
instead.

Scope: architecture, data-structure decisions, and how they're actually implemented.
disney-2026's event content (titles, difficulties) is still partly being filled in — see
"Handling work-in-progress content" below for how the design tolerates that.

---

## 1. Format: a typed TS array replaces CSV, for new trips only

`data/<slug>/bingoes.csv` + `characters.ts`-style side files are replaced, for disney-2026
onward, by a single hand-authored `.ts` array of event objects, typed per-trip. Decided over
CSV-plus-modifiers and plain JSON after working through the tradeoffs directly:

- The bulk-authoring case for CSV (spreadsheet editing, Google Sheets export) doesn't apply
  here — disney-2026 is authored by one person, not exported from a shared sheet, so CSV's
  main advantage doesn't hold.
- The new requirements (mutually-exclusive groups, person-eligibility, guaranteed-everyone
  items, computed/templated fields) need real structure (lists, function values) that a flat
  CSV row can't hold without inventing sub-delimiters and an external cross-referencing file —
  extra indirection with no compile-time safety.
- A plain TS array gets `tsc -b`-checked correctness (already a required build gate), keeps a
  row's full behavior — including any templating — in one place instead of split across a CSV
  row and a side lookup file, and it's the lower-regret choice for a single-author, still-
  evolving spec: a novel one-off requirement is just a function, not a new column/field type
  to invent each time.

europapark-2024's existing CSV pipeline is untouched — no plan to migrate it, since no more
production grids will be generated for it.

---

## 2. `DisneyEvent` — a separate type from the shared `BingoItem`

`type` (the CSV's "Category" column) is dropped entirely from the *shared* `types/trip.ts`
`BingoItem`/`GridCell` — confirmed dead: parsed and carried through today but never read by
`getGrids.ts`, `createGrids.ts`, or any component. This removal applies to both pipelines.

The new fields below do **not** live on the shared `BingoItem`. They're on `DisneyEvent`
(`data/disney-2026/bingoes.ts`), a deliberately separate type — disney-2026's raw event pool
is authored against it, and `data/disney-2026/generateGrids.ts` resolves a `DisneyEvent` down
to a plain `GridCell` (the same output shape europapark-2024 produces) once it's placed into a
grid. Merging `DisneyEvent` into `types/trip.ts` was considered and deliberately deferred —
see "Explicitly decided against" below.

All new fields are **inline on the item itself** (not in an external registry keyed by id —
inline avoids the "does this externally-referenced key still exist" drift-checking problem
entirely):

```ts
// data/disney-2026/bingoes.ts
export interface DisneyEvent {
  summary: string | ((inputs: DisneySeedingInputs) => string);
  description: string | ((inputs: DisneySeedingInputs) => string);
  difficulty: Exclude<Difficulty, "f">;
  guaranteed?: boolean;          // force-included on every grid, see §7
  eligiblePeople?: Person[];     // restricts which grids' pools this item can be drawn into, see §6
  variantGroup?: VariantGroupId; // mutually-exclusive alternates, see §5
}
```

`variantGroup` is typed against a shared const object (`data/disney-2026/variantGroups.ts`),
not a free string or a title-derived slug — group membership needs to be typo-proof and
independent of title wording:

```ts
export const VariantGroup = {
  RIDE_BREAKDOWN: "ride-breakdown",
  FLIGHT_TIMING: "flight-timing",
  SECURITY_INCIDENT: "security-incident",
  // ...one entry per mutually-exclusive group
} as const;
export type VariantGroupId = (typeof VariantGroup)[keyof typeof VariantGroup];
```

`summary` and `description` each become `string | ((inputs: DisneySeedingInputs) => string)` —
independently: a row can template one field and leave the other a plain string. This replaces
europapark-2024's sentinel-string dispatch (`summary === "hug"` etc. in `getGrids.ts`) with
real, per-item, typed functions — no growing `if` chain for each new one-off.

---

## 3. Placeholder resolution — `SeedingInputs`

Per-trip, typed against a shared shape. disney-2026's:

```ts
type DisneySeedingInputs = {
  gridOwner: Person;    // whose grid this cell belongs to
  drinker: Person;      // resolved once per cell, Uniform(Ben, Jason)
  randomPerson: Person; // resolved once per cell, Uniform(all 7 people)
  song: string;         // resolved once per cell, personToSong[gridOwner] (§4)
  shirtNumber: string;  // resolved once per cell, shirtNumbers[gridOwner]
};
```

**Governing rule: every field in `SeedingInputs` is an already-resolved flat value, computed
once per cell, before either `summary` or `description` is called — never a live sampler or a
raw key a resolver looks up itself.** One resolved object gets passed to *both* fields of a
cell. This isn't just tidiness — it's required correctness for `drinker` (title and
description must agree on who the drinker is; independent per-field sampling could diverge)
and it keeps every resolver function trivial (`(inputs) => `We get ${inputs.song}...`` — no
lookup logic duplicated per function).

**Build `SeedingInputs` lazily** — only when at least one of a cell's `summary`/`description`
is a function. Plain-string cells (the majority) never trigger a resolution pass. Besides
avoiding wasted work, this keeps the random stream attributable only to cells that actually
consume it, which matters when diagnosing a failed rejection-sampling attempt (§7).

`drinker`/`randomPerson` were kept as two separate named fields rather than one generic
"uniform draw from an arbitrary list" primitive — two concrete instances isn't enough
repetition yet to justify the abstraction; revisit if a third distinct random-draw need shows
up.

---

## 4. Cross-grid correlated values: standalone scripts, not `makeGrid()` awareness

`makeGrid()` stays entirely per-grid, with **no cross-grid state or awareness at all**. Any
requirement that spans multiple grids (today: song assignment, 7 people over 6 songs) is
handled by a separate, standalone script that runs once, writes a committed lookup file, and
`makeGrid()` only ever consumes that file as a plain input — it has no idea the value came
from a cross-grid process.

- Lives at `data/<slug>/scripts/` — trip-specific, run manually (not wired into `make-grid` or
  any other command). Given the current scale, manual is fine; no attempt at no-code
  generation for this.
- Song assignment algorithm: randomly permute the 7 people, randomly permute the 6 songs,
  cyclic-assign position 1→song 1 ... position 6→song 6, position 7→song 1. Surjective by
  construction (pigeonhole forces exactly one doubled song since 7 > 6), and unbiased: since
  the people-permutation is uniform, the pair occupying positions 1 and 7 (who share a song)
  is a uniform random pair over all 21 possibilities, and independently which song gets
  doubled is uniform since the song-permutation is independent and uniform.
- Output (`data/disney-2026/personToSong.ts`, real content committed) is a **committed,
  one-time artifact** — guarded with a `--force` flag so an accidental second run can't
  silently overwrite the already-decided, already-referenced assignment. Same failure class
  this repo's `make-grid` already guards against for grid files (`getGrids()` never
  overwrites).
- The algorithm itself lives in `data/disney-2026/assignSongs.ts` as a pure function (people
  list, songs list) → assignment, deliberately pulled out of
  `scripts/generatePersonToSong.ts` so it's unit-testable (`assignSongs.test.ts`) without
  touching the filesystem — the script itself is just that function plus the `--force`/file-
  write wrapper.
- Not regenerated per rejection-sampling attempt (§7/§8) — it's a fixed input held constant
  across every retry. Only the in-`makeGrid()` random draws (item selection, positioning) get
  fresh randomness per attempt.
- `shirtNumber` is the same `{ [person]: string }` shape but hand-authored directly, not
  script-generated — the lookup-table shape is what's shared, not how it's produced.

---

## 5. Mutually-exclusive variant groups — per-grid scope

"Only one ride-breakdown variant per grid," "only one flight-timing variant per grid," "only
one security-incident variant per grid" — confirmed **per-grid**, not trip-wide (each of the 7
grids independently may or may not get a breakdown event; if it does, only one variant).

**Actual mechanism** (`selectAllTiers()` in `generateGrids.ts`) — not an append-toward-8,
validate-as-you-go loop (an earlier design considered that shape; abandoned because the three
tiers deplete at different rates, which would need shared mutable state across three
simultaneous per-tier loops just to know when to stop). Instead, one pass over the *full*
shuffled pools, resolved *before* any tier is trimmed to 8:

1. Filter each tier's pool down to what's eligible for this `gridOwner` (§6) — plain yes/no,
   no ordering involved.
2. Pull out `guaranteed` items first (§7) and mark their `variantGroup`s "seen" up front — a
   guaranteed item can't itself have a `variantGroup` (enforced separately, see §7), but this
   ordering still matters for a *non-guaranteed* duplicate of some other guaranteed item's
   group.
3. Shuffle each of the three remaining (non-guaranteed, eligible) pools independently — full
   pools, not trimmed.
4. Merge them into one priority-ordered sequence and walk it **once**: index ascending, and at
   each index, hard before medium before easy (`h[0], m[0], e[0], h[1], m[1], e[1], ...`).
   Whichever candidate is encountered first for a given `variantGroup` is kept; any later
   duplicate — same-tier or cross-tier — is dropped. A group-less item is always kept. This is
   a single deterministic pass, not a retry loop: it always terminates and never fails.
5. Slice the first `8 - guaranteedCount` surviving candidates off each tier's now-deduplicated
   list; combine with that tier's guaranteed items. Underflow throws exactly as below if a
   tier can't reach 8.

This priority order was a deliberate choice — the alternative (index-ascending, no tier
priority) is equally simple, but hard-before-medium-before-easy was picked so ties resolve the
same direction every time rather than needing a separate tiebreak rule.

**A real bug this design replaced**: the first implementation ran this per tier independently,
checking `variantGroup` exclusivity only against what that same tier had already selected —
so a group split across two difficulties (disney-2026's real `FLIGHT_TIMING` and `MERCH`, one
`e`-side member and one `m`-side member) was never actually enforced. Confirmed by regenerating
and finding a real grid with both halves of `MERCH` present together. Fixed by moving to the
single-merged-pass mechanism above, which checks across all three tiers by construction.
Regression-tested (`generateGrids.test.ts`, "never draws two members of the same variantGroup
across different difficulty tiers").

---

## 6. Person-eligibility restriction

`eligiblePeople` narrows which grids' pools an item can be drawn into (e.g. "Stay hydrated"
only for Maria/Ben/Jason/Ciara). Same mechanism as §5 — step 1's eligibility filter
(`!item.eligiblePeople || item.eligiblePeople.includes(gridOwner)`) removes ineligible items
from consideration before shuffling ever happens, so an ineligible item can never be selected
at all, not just rarely.

---

## 7. Guaranteed-on-every-grid items

`guaranteed: true` items are force-included on every single grid, not competing for a random
slot. Mechanism: they're pulled out first, across all tiers, before any shuffling happens
(§5 step 2) — this ordering matters, not just for correctness of the pool math, but because a
guaranteed item needs to outrank *every* ordinary candidate regardless of shuffle timing.
(A naive per-tier stable-sort-by-guaranteed doesn't guarantee this on its own: tiers have
different guaranteed counts, so a tier with fewer guaranteed items reaches its first
non-guaranteed candidate earlier in the merged walk than a tier with more guaranteed items
reaches its later ones — resolving guaranteed items in one pass across all tiers first avoids
that gap entirely.)

Two hard, single-item data-authoring errors, both throw immediately (not silently
skipped, not resolved by priority order):

- **A guaranteed item can't have `eligiblePeople` excluding the current `gridOwner`.**
  "Always included" and "restricted to some people" are contradictory the moment someone
  outside that list is being generated for.
- **A guaranteed item can't have a `variantGroup` at all**, regardless of whether anything
  else actually shares that group. "Always included" and "one of a mutually-exclusive set"
  are contradictory on the same item — this was simplified from an earlier design that only
  threw when *two* guaranteed items collided on the same group; disallowing the combination
  outright on a single item is a strictly simpler, single-item check with the same effect.

Grid shape is unchanged: **8 items per difficulty tier (easy/medium/hard) + 1 free center =
25 cells**, matching the existing fixed 5×5 `difficultyKey` layout. The free cell itself stays
exactly as it is today — a literal inline object, always dead center, entirely outside the
CSV/array/pool system — `guaranteed` is a different, more general mechanism layered
alongside it, not a replacement for it.

Underflow (a tier's eligible, non-guaranteed pool is smaller than the slots remaining after
guaranteed items are placed) **throws**, deliberately not retried — it's a genuine data
insufficiency (not enough content given current eligibility/difficulty splits), not something
a different random shuffle could fix. This is a different failure class from the rejection
sampling in §8/§9, which retries because the failure genuinely is attributable to randomness.

---

## 8. Guaranteed-item positioning: no shared row/column/diagonal

New requirement beyond europapark's old jersey-number mechanic: guaranteed items shouldn't
land on the same row, column, or diagonal as each other within a grid. europapark's old
"constrained to one of N specific candidate positions" approach isn't reused — instead, a
narrow, fast rejection-sampling pass runs *after* a grid's 24 items are already drawn (§7):

1. Randomly assign each guaranteed item an index within its own tier's already-drawn slot
   list (which maps to a specific physical position via the existing fixed `difficultyKey`
   layout).
2. Check all 12 lines (5 rows + 5 columns + 2 diagonals) for more than one guaranteed cell.
3. If any line has more than one, reshuffle *only* the guaranteed items' index assignments
   within their tiers (not the whole grid's item selection) and recheck.

Bounded at **100 attempts** (raised from an original estimate of 20 once implementation testing
measured it: with 3 guaranteed items spread one-per-tier, only ~17% of random combinations
avoid a shared line, so 20 attempts had a ~15% chance of falsely exhausting across a 7-grid trip
on bad luck alone — 100 drops that to statistically zero at negligible cost, since each check is
a handful of comparisons). Throws on true exhaustion (real config issue — e.g. too many
guaranteed items for the layout to ever satisfy — not random bad luck). This loop is
intentionally separate from, and doesn't consume the budget of, the outer per-generation retry
in §9.

disney-2026's real guaranteed-item shape ended up 2-in-one-tier + 1-in-another (not the
original 1-per-tier estimate) — recomputed for that exact shape: ~16.1% success per attempt,
still statistically zero failure risk at 100 attempts. In practice this varies a lot run to
run (the "Positioned guaranteed items (attempt N/100)" log — see §9 — has shown anywhere from
2 to 24 attempts across real runs), which is expected given that success rate, not a sign of a
problem.

---

## 9. Cross-grid balance: full-generation rejection sampling

Separate from §5–§8 (which govern a single grid's construction), this is a whole-trip check
run after all 7 grids are fully built. Differs from the original design in a few real ways,
below — the shape (compute a distribution, decide pass/fail, retry-from-scratch on failure)
held up; the specific rule and its ergonomics evolved a lot through actual use.

**Distribution**: a flat `number[]` indexed by each event's position in the source `events`
array (not a `titleToSlug`-keyed structure as originally sketched — index-based identity is
simpler and works uniformly for both plain-string and function-valued `summary` events, which
a title-derived slug can't do for the latter). `guaranteed` events are excluded from every
diagnostic and from the balance decision itself — they always appear on all 7 grids by
construction, so including them just pads the "appeared often" end with entries that were
never actually subject to randomness.

**The rule** (`checkBalance()`), currently: every non-guaranteed event must appear at least
once at all (a hard, unconditional floor — zero appearances is an immediate fail regardless of
the ratio below), *and* at least `BALANCE_MIN_APPEARANCE_RATIO` (currently `0.99`) of them must
appear at least twice across the 7 grids. This is much stricter than the original "≥70% appear
twice" sketch — tightened deliberately through real testing, not yet fully settled. One
constraint worth knowing before tightening further: an `eligiblePeople`-restricted event's
maximum possible appearances is capped by how many people it's eligible for (an event
restricted to 1 person can never appear more than once, ever — no number of retries fixes
that, since it isn't bad luck). Real content currently keeps every restriction at 3+ people
specifically so this stays achievable.

**`balanceMinAppearanceRatio` is a parameter of `getDisneyGrids()`**, defaulting to the module
constant (so production/`scripts/generateGrids.ts` is unaffected by omitting it) — passing `0`
disables balance checking entirely, including the zero-appearances floor. This is the escape
hatch structural/mechanism tests need: a test asserting variantGroup exclusivity or
positioning correctness shouldn't be coupled to whatever ratio production happens to be tuned
to, and one test fixture's `eligiblePeople` restriction to a single person was genuinely
*impossible* to pass under the current strict rule before this existed (not just unlucky) —
that's what surfaced the need for it.

**Bounded at `MAX_GENERATION_ATTEMPTS`** (currently `600`, raised from an original estimate of
5 as the ratio tightened). On failure: reject the entire generation and restart from scratch
with fresh randomness for all 7 grids — never hand-patch individual grids, for the same
sample-bias reason as before. **Nothing is written or seeded until an attempt passes.**

**Diagnostic logging** (all plain `console.log`, always on, not gated behind a flag — this is
a manually-run dev/content tool, not a CI check):

- `Generating <person>'s grid...` — one per person, per attempt.
- `Collision in guaranteed item positioning, retrying...` and, once resolved,
  `Positioned guaranteed items (attempt N/100)` if it took more than one try — nested under
  the per-person line above, which is why these don't repeat the person's name themselves.
- Per attempt, a `|`-bordered table of appearance-count histograms, one column per difficulty
  (`e`/`m`/`h` — never merged into one table, since the tiers have very different pool sizes
  and a merged table would make the smaller tier look artificially healthier), rows `0` to
  `people.length`, `.` marking a zero cell. Cell content is 2 chars wide, 2 spaces padding
  either side.
- Underneath, `Appeared 0-1 times:` followed by one bulleted line per event at 0x or 1x,
  naming it and its difficulty, sorted by count then by `e`/`m`/`h` — the actual triage list
  for deciding what needs a difficulty change, a `guaranteed` bump, or a broader
  `eligiblePeople` set.

This logging is what real testing has been done against — e.g. a real run against actual
content once genuinely failed after exhausting all 600 attempts in ~1.6s (failing that fast
strongly suggests a structural pool-size issue — `M`'s pool being much larger than `e`/`h`,
averaging well under 2 appearances per item across the fixed 56 total draws — rather than
something more attempts would fix). Resolving that kind of finding is real content/tuning
work, not something this doc prescribes an answer for.

---

## 10. Handling work-in-progress content

Difficulty and title content for disney-2026 took a while to finalize (and some still isn't).
Actually used, simpler than the original sketch: **real, valid placeholder values, flagged
with a trailing comment, not `null` or nullable typing.** A not-yet-decided `summary` is a
literal string like `"placeholder shirt number find"` tagged `// TODO`; a not-yet-decided
`difficulty` is a real, valid tier (e.g. `"e"`) tagged `// PLACEHOLDER - CHANGE`, spread
roughly evenly across `e`/`m`/`h` rather than defaulted to one tier — defaulting everything to
`"e"` would starve the other tiers below the 8-per-grid floor and make the pipeline
untestable. This needed no type loosening at all: `DisneyEvent`'s fields stay exactly as
typed, `tsc -b` still catches a genuine mistake, and a human skimming the file for
still-`// TODO`/`// PLACEHOLDER` comments is the actual review mechanism, not a type-level one.

Because grid construction reduces to "draw 8 per difficulty tier under the constraints in
§5–§8, then place them," the pool-building/variant-group/eligibility/guaranteed/positioning
logic is unit-tested (`generateGrids.test.ts`) against typed mock `DisneyEvent` arrays entirely
independent of real content — most of those tests pass `balanceMinAppearanceRatio: 0` (§9) so
they're also independent of whatever balance rule production happens to be tuned to.

---

## Explicitly decided against / superseded

- **Linked multi-field placeholders** (`%p.name` + `%p.description` resolving to the same
  draw) — dissolved by the function-value approach. A resolver can read as many
  `SeedingInputs` fields as it needs directly; no dotted-path token syntax required.
- **CSV quoted-field parsing fix** — moot for disney-2026 (no CSV in this pipeline). Still a
  real gap in europapark-2024's pipeline, documented in `csv-grid-pipeline-notes.md`, not
  being fixed since europapark won't get new grids.
- **A CSV-plus-`modifiers.ts` id/registry split** — considered, dropped once the format
  decision landed on a pure TS array; no separate row-id cross-referencing is needed when a
  row's function lives inline on the object itself.
- **Deeper drinker-balance stretch goal** (generate with `{{drinker}}` unresolved, count
  occurrences, then rebalance Ben/Jason assignment for even split) — explicitly deferred.
  Uniform-per-cell sampling is good enough for v1; a two-name imbalance can be adjusted by
  hand if it matters.
- **"Team" grid** — 2nd priority, explicitly parked until disney-2026 seeding lands, not part
  of this design. One additional grid, hand-authored rather than drawn from the random pool at
  all ("seeding isn't as relevant" for it). Holds shared bingo items (team/group-wide events,
  as opposed to any one individual's), appearing **alongside the per-person grids, at the top**
  of the trip page. Open questions, genuinely not decided:
  - **Implementation shape**: whether "Team" becomes just another entry in the `people:
    string[]` array (reusing `grids[i] ↔ people[i]` parallel-array rendering in
    `TripPage.tsx`/`seedGrid.ts` for free, with "Team" as a synthetic person name) or needs a
    structurally distinct field (e.g. a separate `teamGrid` on `LoadedTrip`/`TripConfig`,
    rendered with its own special-cased `<li>` before the `grids.map(...)` loop) — explicitly
    open either way, "whatever is easiest in the long term." If it does become a `people[]`
    entry, it needs to sort/render first — no existing "pin to top" concept exists anywhere in
    `TripPage.tsx`'s rendering today.
  - **Sequencing**: the Team grid's hand-authored cells need to be added to the grid JSON
    *after* generation but *before* seeding, specifically so they still get real `checked`
    rows (tripSlug + gridVersion + cellId + person) and are trackable through the same
    checked-state API as everyone else's cells. This part is actually **already solved** by
    the make-grid/seed-grid decoupling (`CLAUDE.md`) — generation and seeding are two
    separate, deliberate steps for every trip now, not just this one, so the gap this idea
    needed already exists as the default. Splicing Team cells (new, unique `cellId`s) into a
    written grid file before running `seed-grid` is confirmed safe: `checked` (`db/schema.ts`)
    has no content columns at all, so a hand-edit followed by `seed-grid`'s
    `onConflictDoNothing()` insert is unambiguously safe either way.

---

## Open work

Absorbed from `temp-prompt.md` (deleted — its design content is above, this is what's still
genuinely unfinished):

- **Content**: most placeholder summaries/difficulties in `bingoes.ts` are filled in with real
  values now (real shirt numbers, real songs, real difficulty tags for most events), but a
  `// TODO`/`// PLACEHOLDER - CHANGE` grep over the file still finds genuine stragglers — that
  grep is the actual up-to-date status, not this doc.
- **The balance rule itself** (§9) is still being tuned against real content, not settled —
  the last real test against actual content failed outright (exhausted all 600 attempts in
  ~1.6s), which points at pool-size shape (`M` in particular) rather than the threshold number
  itself, but neither has been resolved yet.
- **Multi-slug, for real, has never been exercised.** This repo has only ever had one live
  trip. Before disney-2026 actually goes live: two `grids/<slug>/` dirs, two
  `config/trips.json` entries, `checked` rows for two slugs at once, `/` listing both, and the
  service worker's per-slug `trip-data/` runtime caching all need to be confirmed working
  simultaneously — not just assumed to work because the design was slug-agnostic.
- **Seeding hasn't happened at all** — `grids/disney-2026/<n>.json` has never been seeded to
  any database, local or production.
