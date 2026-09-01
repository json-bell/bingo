# Templated grid content & seeding design

Why this exists: `temp-prompt.md` (repo root, session-scoped working doc) tracked the
disney-2026 seeding investigation and design discussion across several sessions. That
discussion is now decided. This doc is the durable record of what was decided — the new
`BingoItem` shape, the placeholder/templating mechanism, the mutually-exclusive/eligibility/
guaranteed-item rules, and the two rejection-sampling passes — so it survives independent of
`temp-prompt.md`, which stays around only for tracking what's still *unimplemented* (see its
own file for that). `csv-grid-pipeline-notes.md` (repo root) remains an accurate description
of the **existing** europapark-2024 CSV pipeline, which is not being touched or migrated —
this doc describes the **new**, TS-array-based pipeline that disney-2026 (and any future trip)
uses instead.

Scope: architecture and data-structure decisions only. Nothing described here is implemented
yet. disney-2026's actual event content (titles, difficulties) is also still being drafted —
see "Handling work-in-progress content" below for how the design tolerates that.

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

## 2. `BingoItem` shape

`type` (the CSV's "Category" column) is dropped entirely — confirmed dead: parsed and carried
through `BingoItem`/`GridCell` today but never read by `getGrids.ts`, `createGrids.ts`, or any
component (`rg` for `.type` usage across `src/`/`data/` finds nothing beyond two literal
assignments for the synthesized "free"/"challenge" cells).

New optional fields, all **inline on the item itself** (not in an external registry keyed by
id — inline avoids the "does this externally-referenced key still exist" drift-checking
problem entirely):

```ts
guaranteed?: boolean;        // force-included on every grid, see §6
eligiblePeople?: Person[];   // restricts which grids' pools this item can be drawn into
variantGroup?: VariantGroupId; // mutually-exclusive alternates, see §5
```

`variantGroup` is typed against a shared const object, not a free string or a title-derived
slug — group membership needs to be typo-proof and independent of title wording:

```ts
export const VariantGroup = {
  RIDE_BREAKDOWN: "ride-breakdown",
  FLIGHT_TIMING: "flight-timing",
  SECURITY_INCIDENT: "security-incident",
  // ...one entry per mutually-exclusive group
} as const;
export type VariantGroupId = (typeof VariantGroup)[keyof typeof VariantGroup];
```

`summary` and `description` each become `string | ((inputs: SeedingInputs) => string)` —
independently: a row can template one field and leave the other a plain string. This replaces
today's sentinel-string dispatch (`summary === "hug"` etc. in `getGrids.ts`) with real,
per-item, typed functions — no growing `if` chain for each new one-off.

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
- Output (e.g. `data/disney-2026/personToSong.ts`) is a **committed, one-time artifact** —
  guarded with a `--force` flag so an accidental second run can't silently overwrite the
  already-decided, already-referenced assignment. Same failure class this repo's `make-grid`
  already guards against for grid files (`getGrids()` never overwrites).
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

Mechanism, inside `makeGrid()`'s per-difficulty-tier pool building: shuffle each tier's
candidate pool for this grid, then pop one at a time, validating each candidate against
everything already appended to *this grid* (across all tiers, not just the current one)
before accepting it — if an item with the same `variantGroup` is already present, discard and
pop the next candidate instead. This is the same "can we add this item?" predicate used for
eligibility (§6), just checking a different condition.

---

## 6. Person-eligibility restriction

`eligiblePeople` narrows which grids' pools an item can be drawn into (e.g. "Stay hydrated"
only for Maria/Ben/Jason/Ciara). Same shuffle-and-validate-on-pop loop as §5: before accepting
a popped candidate, check `!item.eligiblePeople || item.eligiblePeople.includes(gridOwner)`;
discard and continue popping if it fails.

---

## 7. Guaranteed-on-every-grid items

`guaranteed: true` items are force-included on every single grid, not competing for a random
slot. Mechanism: for each difficulty tier, pre-seed that tier's array with its guaranteed
items *before* the shuffle-and-pop loop runs; the pop loop then only fills the tier's
remaining slots (`8 - guaranteedCountInTier`) from the rest of that tier's (non-guaranteed)
pool.

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

Bounded at **20 attempts**, throws on exhaustion (real config issue — e.g. too many guaranteed
items for the layout to ever satisfy — not random bad luck). This loop is intentionally
separate from, and doesn't consume the budget of, the outer per-generation retry in §9 — it's
cheap (a handful of marked cells, 12 line checks) and expected to converge almost immediately.

---

## 9. Cross-grid balance: full-generation rejection sampling

Separate from §5–§8 (which govern a single grid's construction), this is a whole-trip check
run after all 7 grids are fully built:

- A shared, trip-agnostic step computes an item-appearance distribution across all 7 grids,
  keyed by a stable per-item identifier (`titleToSlug(summary)` — e.g. "Still Got It" →
  "still-got-it"; fine for this narrower purpose since nothing else cross-references it, unlike
  `variantGroup` which needed the typo-proof shared-const treatment). Shape:
  `{ easy: { [itemSlug]: number }, medium: {...}, hard: {...} }`.
- A **trip-specific** `postGeneration.ts` (e.g. `data/disney-2026/postGeneration.ts`) consumes
  that distribution and decides pass/fail against a manually-chosen balance rule — e.g. "at
  least 70% of items appear at least twice across the 7 grids." The threshold/rule is
  deliberately not generalized into shared code; it's a per-trip policy decision.
- On failure: **reject the entire generation and restart from scratch** with fresh randomness
  for all 7 grids — never hand-patch individual grids to fix a balance failure, since that
  would bias the sample in a way the rejection-sampling approach is specifically meant to
  avoid.
- Bounded at **5 attempts**, with per-attempt logging (attempt number, pass/fail, which
  criterion failed, roughly what stage it reached) to make a run of failures diagnosable.
- **Nothing is written or seeded until an attempt passes** — `grids/<slug>/<n>.json` isn't
  written and `seedGrid()` isn't called for a failed attempt; both only happen once for the
  attempt that ultimately passes.

---

## 10. Handling work-in-progress content

Difficulty and title/description content for disney-2026 isn't finalized yet. The design
tolerates this deliberately: `difficulty: Difficulty | null` and similar nullable typing for
unfinished fields, initialized to `null`, filled in later (real data, or `null`-safe fake data
flagged `// TODO`). Because grid construction reduces to "draw 8 per difficulty tier under the
constraints in §5–§8, then place them," the pool-building/variant-group/eligibility/
guaranteed/positioning logic can be unit-tested against typed mock `BingoItem` arrays entirely
independent of whether real content is ready.

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
- **"Team" grid** (hand-authored, shared, group-wide grid alongside per-person ones) — 2nd
  priority, explicitly parked until disney-2026 seeding lands. Still tracked in
  `temp-prompt.md`, not part of this design.
