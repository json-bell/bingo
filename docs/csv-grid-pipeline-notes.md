<!--
PERSISTENT REFERENCE — companion to temp-prompt.md for the disney-2026 push.

Purpose: pure, verified facts about how the existing CSV → grid pipeline and
its ad-hoc templating actually work today. temp-prompt.md owns the plan,
open questions, and decisions for the disney-2026 initiative; this file owns
the "what does the code currently do" findings those decisions get made
against, so they survive even if a session ends mid-discussion. Update this
file when new architecture facts are confirmed; keep planning/narrative
content in temp-prompt.md instead.

Everything below was verified directly against source in this repo as of
2026-08-31 (file:line references included so they're easy to re-check if
the code moves).
-->

# CSV → grid pipeline: how it actually works today

## The chain

`data/<slug>/bingoes.csv`
  → `data/generateDataFile.ts` (`generateDataFile()`) parses the CSV, writes `data/<slug>/data.ts`
  → `data/createGrids.ts` (the `make-grid` CLI) imports `data.ts` + `characters.ts` + `people.ts`,
    calls `data/getGrids.ts`'s `getGrids()`, writes `grids/<slug>/<n>.json`, then calls `seedGrid()`

See `.claude/rules/architecture.md` for the already-documented general shape of this
(slug routing, `config/trips.json`, component tree). This file covers what's
specific to CSV columns and the templating/special-case logic inside `makeGrid()`,
which isn't written up elsewhere.

## CSV format and parsing (`data/generateDataFile.ts`)

- Exactly 4 columns, positional: `Category, difficulty, summary, description`
  (`data/europapark-2024/bingoes.csv:2`). "Category" in the header becomes
  `type` in `BingoItem`/`GridCell` — a rename, not a 5th field
  (`generateDataFile.ts:25`).
- `difficulty` must be exactly `"e"`, `"m"`, or `"h"` — checked by
  `isEventDifficulty()` (`generateDataFile.ts:4-8`). **Any other value
  silently drops the entire row** from `data.rows`, no error or warning
  (`generateDataFile.ts:24`). The real CSV leans on this as an intentional
  exclusion mechanism — see "Dead rows" below.
  - `"f"` (free) is a valid `Difficulty` union member but is never produced
    by a CSV row — it's synthesized only for the center cell, inline in
    `getGrids.ts` (`getGrids.ts:52-54`).
- **Not a real CSV parser — no quoted-field handling at all**:
  `rawText.split("SPLITHERE")[0]` (drops everything after that literal
  string — an undocumented end-of-data marker), then `.split(",,,\r\n")`
  (blank row = section break), then a naive `row.split(",")` per line
  (`generateDataFile.ts:17-23`). A description containing a literal comma
  (plausible from a Google Sheets export) silently shifts every column
  after it — corrupting `type`/`difficulty`/`summary` with no error. It
  either gets filtered out by the difficulty check (a real row silently
  lost) or produces a bogus-but-valid-looking row.

## Templating: one hardcoded mechanism, not a general system (`data/getGrids.ts`)

There is exactly one fill-in-blank mechanism today, entirely inside `makeGrid()`,
keyed by exact/substring match on `summary`:

- `characters.ts` (`data/<slug>/characters.ts`) is a flat `string[]` of
  theme-park mascot names — unrelated to `people.ts` (real group members).
  Europapark's version: 5 entries, several with parenthetical "not sure who
  this is" author notes still in them (`characters.ts:1-7`).
- `getShuffledCharArray()` builds a **shuffled copy per person's grid**
  (called once inside `makeGrid`, so each grid gets its own independent
  pool — not trip-wide), prepended with the sentinel string
  `"TOO MANY NEW BINGO PLS"` as the overflow fallback if a grid needs more
  character-fills than there are real characters (`getGrids.ts:10-18`).
- Any drawn `BingoItem` whose `summary` is exactly `"hug"` or `"fistbump"`
  gets its **`description` completely overwritten** by `addCharName()`:
  `description = summary + " " + name`, `name` popped from that grid's
  shuffled pool (`getGrids.ts:28-30`, called at `getGrids.ts:64-67`).
  Whatever was in the CSV's description column for that row is discarded
  entirely; `summary` is untouched.
- Two more separate hardcoded special cases in the same function
  (`getGrids.ts:68-88`), each its own `if` block:
  - `summary === "other"`: picks a random Hug/Fistbump action, rewrites
    both `summary` and `description`.
  - `summary.includes("jersey pic")`: picks between two hardcoded variants
    (1 vs 2 jersey photos), rewrites both fields.

  Any future one-off substitution needs a new `if` block here — this is
  the concrete inflexibility the `%p`/`%l` design is meant to replace.

## Dead rows: the CSV already contains rows the code never uses

- `bingoes.csv` rows 63–72 use `difficulty = "Dupl"` (one row per specific
  character, e.g. `"Hug 'Louis'..."`, `"Fist bump broccoli"`) — `"Dupl"`
  isn't a valid `Difficulty`, so every one of these is filtered out before
  reaching `data.rows` (confirmed via `grep -n Dupl bingoes.csv`; verified
  count: 7 rows, difficulty values `Dupl`/`Dupl`/etc., none pass
  `isEventDifficulty`).
- Row 57, `challenge,ALL m,jersey num,...`, is dead for the same reason —
  `"ALL m"` isn't valid either. The CSV *documents* a jersey-number event
  but the code never reads this row (see next section for where the real
  guarantee actually lives).
- Even where a hug/fistbump row's description *does* have a real character
  name hand-typed in (e.g. row 63: `"Hug 'Louis'..."`), that text is
  irrelevant even hypothetically — `addCharName()` always overwrites
  `description` with a randomly-drawn character regardless of which CSV
  row was picked (`getGrids.ts:29`), so the specific name in the CSV was
  never wired to anything.
- Confirmed by diffing against the earlier draft
  `data/archive/europapark-2024/bingoes copy.csv`, where the same rows
  just read `"Hug "` / `"Fistbump "` (trailing space, no name at all —
  verified via `grep -n Dupl "bingoes copy.csv"`, rows 10-19, using
  difficulty values `e`/`n`/`na`, none valid either). The literal names in
  the current CSV were added later purely for human readability while
  skimming the sheet, not because the code ever reads them.

**Implication for the new design**: either a templated `%p hugs %c`-style
row covers what today takes 5+ dead per-character rows, or if duplicate
rows are kept as an explicit "how many of this event type in the pool"
mechanism, that should be a declared repeat-count property — not disguised
as distinct rows with descriptions nobody reads.

## Free cell and jersey number: a third, separate hardcoded mechanism

Fully outside the CSV/templating system entirely — not pool-drawn at all:

- **Free cell**: `difficultyKey` (`getGrids.ts:20-26`) is a fixed 5×5 array
  of difficulty letters — `"f"` always dead center. Grid *layout* (which
  position gets which difficulty) is 100% deterministic; only *which event*
  fills a given position is random. The free cell's content is a literal
  inline object (`getGrids.ts:53`), never touches the CSV or any pool.
- **Jersey number**: the CSV row for it (`ALL m`, row 57) is dead, as
  noted above. The real guarantee lives entirely in `makeGrid()`
  (`getGrids.ts:38-47`): after the medium pool is shuffled into `medOrder`,
  one of 4 candidate positions near the end of that array —
  `jerseyIndex = medLength - 1 - [0,3,4,7][edgeIndex]`, `edgeIndex` random
  0–3 — is **force-overwritten** with a hardcoded jersey-number `BingoItem`,
  unconditionally, before any per-difficulty popping happens. This
  guarantees exactly one jersey-number cell per grid, constrained to a
  small set of physical positions (not any arbitrary medium cell).

**Why this matters for the placeholder design**: the codebase already has
two working, hardcoded, single-purpose examples of "guarantee exactly N of
this thing, possibly in a constrained position" — completely separate from
the CSV/pool/templating path. A general design may need to cover this
pattern too, not just free-text `%p`/`%l` substitution, so a future one of
these doesn't need another bespoke `if` block. (Open question — see
temp-prompt.md — whether that's in scope for this pass.)

## `checked` table: content vs. tracking (`db/schema.ts`)

`checked` has **no content columns at all** — just `cellId` (text, PK),
`checked` (boolean), `updatedAt`, `tripSlug`, `gridVersion`, `person`
(`db/schema.ts:3-36`). Cell content (summary/description/difficulty/type)
lives only in the static `grids/<slug>/<n>.json`, never in SQL.
`seedGrid()`'s insert is `onConflictDoNothing()` keyed on `cellId` — purely
about row *existence* for checked-state tracking, not content. Practical
consequence: hand-editing a grid JSON file to splice in new cells (new,
unique `cellId`s) and then re-running `npm run seed-grid -- <slug> <version>`
is safe — new ids insert as new rows, pre-existing ones are silently
skipped since there's nothing in them a reseed could update anyway.

## Multi-slug support: structurally ready, never actually exercised

- `config/trips.json` is already `Record<string, TripConfig>`
  (`types/trip.ts:26`, confirmed current content is a single-key object at
  `config/trips.json:1-3` — nothing slug-count-specific in the type or the
  file).
- `checked` is already keyed by `tripSlug` + `gridVersion` + `cellId`
  (`db/schema.ts`), with an index on `(tripSlug, gridVersion)`.
- `.claude/rules/architecture.md` already documents "adding a new slug is
  data + one `config/trips.json` line, no code changes" — via
  `import.meta.glob` in `src/lib/trips.ts`.
- None of this has ever run with two real slugs coexisting — one
  `europapark-2024` trip is the only one that's ever existed in this repo.
  Nothing has verified two `grids/<slug>/` dirs, two live `trips.json`
  entries, `checked` rows for two slugs at once, `/` listing two trips, or
  the service worker's per-slug `trip-data/` runtime-cache chunking
  (`docs/backend-architecture.md` §9) all working simultaneously.
