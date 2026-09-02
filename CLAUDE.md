# Project instructions for Claude Code

## Project overview

A single-page React + TypeScript app that renders bingo grids for group trips. Each trip is a
"slug" (e.g. `europapark-2024`) routed client-side at `/:slug` via `react-router-dom`; `/`
lists known slugs. Every slug has its own people list and its own numbered, pre-generated grid
files (`grids/<slug>/<n>.json`, built by `npm run make-grid`, not generated at runtime) —
`config/trips.json` says which numbered version is currently live for each slug. Deployed to
Vercel (`vercel.json` has the SPA catch-all rewrite it needs) — previously dragged `dist/`
into Vercel by hand, and briefly set up for GitHub Pages before switching back to Vercel for
proper path-based routing without a redirect trick.

Shared data-structure types (`BingoItem`, `GridCell`, `Difficulty`, `Grid`, `TripConfig`,
`LoadedTrip`) live in `types/trip.ts` at the repo root, imported by both `src/` (the app,
browser/DOM context) and `data/` (the Node generator scripts) — it's the one place those
shapes are defined, don't redeclare them locally in either. `BingoItem` (a template event
still in the shuffle pool, `data/<slug>/data.ts`) and `GridCell` (that same shape once
placed into a specific person's grid, with an added `id`) are deliberately separate types,
not the same one reused — the same source event can end up placed into several different
people's grids, each as its own cell needing its own id, so the id can't live on the
template.

## Commands

These are the real, verified commands for this repo. Don't guess alternatives (`yarn` vs `npm` vs `pnpm` etc.) — if a command below is wrong or missing, fix this section or prompt the user to fix it rather than trying variations.

| Task           | Command                                   |
| -------------- | ------------------------------------------ |
| Dev server     | `npm run dev`                             |
| Dev server **with** the backend API | `npm run dev:api` (`vercel dev`) — see the note below; plain `npm run dev` never serves `api/` at all |
| Build          | `npm run build` (runs `tsc -b` first — build fails on type errors, not just bundling errors) |
| Typecheck only | `npm run tscheck`                         |
| Preview build  | `npm run preview`                         |
| Lint           | `npm run lint -- --quiet`                 |
| Tests          | `npm run test` (Vitest, run-once — not watch mode) |
| Generate a new disney-2026 grid version (primary, current pipeline) | `npm run make-grid` — writes the local JSON only, does **not** seed any database; see below |
| Generate a new europapark-2024 grid version (archived CSV pipeline) | `npm run make-grid:europapark-2024` — same JSON-only behavior |
| Seed a grid version's `checked` rows (local DB) | `npm run seed-grid -- <slug> <version>` or `npm run seed-grid:dev -- <slug> <version>` (identical) |
| Seed a grid version's `checked` rows (**production**) | `npm run seed-grid:prod -- <slug> <version>` |
| Start local Postgres | `npm run db:up` (`docker compose up -d --wait`) |
| Stop local Postgres | `npm run db:down` |
| Reset local Postgres completely | `npm run db:reset` |
| Apply migrations (dev DB) | `npm run db:migrate` |
| Generate a migration from `db/schema.ts` | `npm run db:generate` |
| Inspect local DB data | `npm run db:studio` |

`npm run dev` (plain `vite`) never serves `api/` — Vite knows nothing about Vercel
Functions, so any `/api/*` request just 404s, which looks exactly like being offline once
the frontend integration lands. Use `npm run dev:api` (`vercel dev`) whenever backend
behavior is in question; it runs the Vite dev server and the `api/` functions together on
one port with real routing. Two one-time project-settings gotchas, already fixed on the
live Vercel project but worth knowing if `vercel dev` ever breaks again: the project's
**Framework Preset must be `vite`**, not `Other` — with `Other`, Vercel doesn't pass
`--port $PORT` to the dev command, so it can't find the server it just started
("Failed to detect a server running on port ..."). And **local secrets for `vercel dev`'s
functions come from the Vercel project's own *Development*-scoped environment variables
(`vercel env add <NAME> development`), not from `.env.local`** — `.env.local` is what the
Vite dev *command* reads, but the function runtime pulls from the cloud-stored Development
environment instead, so a var only present in `.env.local` silently isn't there for `api/`
handlers (`DATABASE_URL is not set`) even though the frontend works fine.

**Two separate `make-grid` commands, two separate pipelines** — `npm run make-grid` (primary,
current) and `npm run make-grid:europapark-2024` (archived). They are not interchangeable and
don't share a slug argument; each is hardcoded to its own trip.

`npm run make-grid` runs `data/disney-2026/scripts/generateGrids.ts` — disney-2026's TS-array
event pool (`data/disney-2026/bingoes.ts`, see `docs/grid-content-pipeline.md`), not a CSV.
Writes a new auto-numbered `grids/disney-2026/<n>.json` (never overwrites an existing
version) and prints next steps. This is the pipeline any *new* trip should follow going
forward.

`npm run make-grid:europapark-2024` runs `data/createGrids.ts` via `tsx` (not `node` — these
are `.ts` files, not compiled ahead of time), hardcoded to the `europapark-2024` slug. Reads
`data/europapark-2024/bingoes.csv`, writes a new auto-numbered `grids/europapark-2024/<n>.json`
(same never-overwrite behavior). **Archived, not actively developed** — kept working because
europapark-2024 was built on it, but no new trip should use the CSV/`characters.ts` pattern;
see `docs/csv-grid-pipeline-notes.md` for its real limitations and why disney-2026 moved off it.
`data/createGrids.ts` itself is intentionally left as-is (not refactored to share code with
the new pipeline) — see `docs/grid-content-pipeline.md` for why generalizing across the two
was deliberately deferred.

Both pipelines' promotion/rollback is the same: editing the live version number in
`config/trips.json` — no file renaming or manual promotion step either way.

Superseded content drafts go in `data/archive/<slug>/`, not `data/<slug>/` — keeps them
accessible without digging through git history, without cluttering the directory the
generator actually reads from. For europapark-2024's archived CSV pipeline that's superseded
`bingoes.csv` drafts; disney-2026's `data/archive/disney-2026/draft-ideas.md` is the original
raw content list `bingoes.ts` was converted from and has since evolved well past.

**Both `make-grid` commands are deliberately decoupled from seeding — neither ever touches
any database.** Seeding is always a separate, explicit step: `npm run seed-grid -- <slug>
<version>` (or the identical `seed-grid:dev`) for local, `npm run seed-grid:prod -- <slug>
<version>` for production (`data/seedGridCli.ts` in both cases — it reads the already-written
`grids/<slug>/<version>.json` off disk and calls `seedGrid()`, so it's the only seeding path,
not a fallback for one). This used to be folded into the old `make-grid` itself (one command,
so the step "can't be forgotten") but was deliberately split apart — always requiring the
explicit step means there's no ambiguity about *when* seeding happens or which database it
hit. **Which database gets seeded is whichever `DATABASE_URL` is set in the environment when
`seed-grid` (not either `make-grid` command) runs** — a human decision at seed time, not
something inferred. Re-running either `make-grid` command after any point does **not** retry
a seed and was never meant to: grid generation is unseeded-random and never overwrites, so a
second run mints an entirely new version with a different set of cell ids, orphaning whatever
grid file already exists — always re-run `seed-grid` against the existing version's file,
never `make-grid`.

`npm run seed-grid:prod` and `npm run migrate:prod` are convenience wrappers that source
`~/.config/bingo-prod.env` (`export DATABASE_URL=<pooled>`, `export
DATABASE_URL_UNPOOLED=<unpooled>`) before running the plain command — **that file is
local-only, never committed, and won't exist on a fresh clone or a different machine**; the
scripts fail cleanly with a "no such file" error in that case, which is expected, not a sign
anything's broken. The path is deliberately hardcoded into these scripts (not a secret
itself, only the file's contents are) so production commands don't need the real connection
string typed inline. `seed-grid:prod` and `migrate:prod` both override to the unpooled
string.

Requires **Node 19+**: `data/getGrids.ts` and `data/backfillCellIds.ts` call the global
`crypto.randomUUID()` with no import (stable in Node 19+; not present at all on older
versions) — an older Node fails with a confusing "crypto is not defined"-style error, not
an obvious version-mismatch message.

Tests are Vitest — see `docs/test-plan.md` for the short/long-term test plan and why
Vitest specifically (it understands `import.meta.glob`, used in `src/lib/trips.ts`,
natively). Two real gotchas from setting it up, both already fixed:
jsdom implements `HTMLDialogElement` as a class but doesn't implement `showModal()`/
`close()` at all — `vitest.setup.ts` polyfills both by toggling the `open` attribute,
which is enough for anything a test can observe. And Vite's dynamic `import()` needs a
statically-analyzable specifier, so a test that needs to read back a file written to a
runtime-only path (e.g. a disposable fixture slug under `data/`) should read and parse
the file's source directly instead of importing it as a module — see
`data/generateDataFile.test.ts` for the pattern.

_If a quiet run fails or the output is unhelpfully sparse, drop the flag for that one invocation and re-run — quiet is the default, not a hard rule._

`eslint-plugin-react-refresh` is pinned at 0.3.x (older than the version that introduced the
`allowConstantExport` rule option) — don't add that option to `.eslintrc.cjs` without bumping
the dependency first, it'll fail config validation.

Styling is Tailwind v4 (`@tailwindcss/vite`, wired into `vite.config.ts`; `src/index.css` is
just `@import "tailwindcss";` plus the genuinely global `:root`/`body` rules — everything else
is utility classes on the components themselves, not shared CSS files). This requires Vite 5+;
that's why `vite`/`@vitejs/plugin-react` are pinned well above the versions the project
originally shipped with. When a component needs two candidate background-color utilities
(e.g. a default vs. a conditional one), only ever put one `bg-[...]`-type class in the
rendered className at a time — Tailwind resolves conflicting utilities by generated
stylesheet order, not by their order in the className string, so having both present at once
means one silently and unpredictably wins regardless of which condition is "supposed" to
apply (see `Tile.tsx`'s `bgClass` for the pattern: pick one string, don't concatenate).

`typescript` is pinned to the 6.x line (`^6.0.3`), not latest — `typescript-eslint` doesn't
yet support TypeScript 7 (a separate, incompatible rewrite of the compiler). Don't
`npm install typescript@latest` without checking `typescript-eslint`'s support status first,
or lint will hard-fail with "typescript-eslint does not support TS 7.0."

Colors are semantic design tokens defined in `src/index.css`'s `@theme` block, which holds
several complete palettes as alternate blocks — exactly ONE should be uncommented at a time
(CSS custom properties don't merge; two active blocks means the lower one silently wins with
no error, and zero active blocks means Tailwind can't generate `bg-background` etc. at all and
the build hard-fails). Check `npm run build` after touching this file for exactly that reason.
The tokens: `background`/`foreground` for the page, `surface` for the per-person card panel,
`ink`/`ink-muted` for text on `surface`, `brand`/`secondary`/`accent` for brand accents,
`tile`/`tile-foreground` for the grid-cell base (free/no-difficulty cells — NOT necessarily the
same as `surface`; it exists because a "make surface a dark secondary panel" variant still
needed light cells), and `tile-easy`/`-medium`/`-hard` (solid, precomputed blends of each
difficulty hue with white — not `bg-difficulty-easy/10`, since alpha-over-whatever's-behind
went nearly invisible once `surface`/cells went dark; a precomputed solid color doesn't have
that problem). Every block must also set `brand-foreground`/`secondary-foreground` explicitly
— don't rely on inheriting `foreground`/`ink` and assume it'll contrast, that's genuinely
broken working state at least twice already (header rendered dark-on-dark, nav text failed
contrast on its own bar). Check contrast (WCAG AA: 4.5:1 normal text, 3:1 for large/bold like
headings) before pairing any new background with a text color rather than assuming it'll work.
Never reach for a raw `bg-[#hex]`/`bg-[rgb(...)]` arbitrary value for anything that already has
a semantic token; add a new token (to every block) instead if none of the existing ones fit.

`Tile.tsx`'s tile is clickable (native `<dialog>` + `ref`, `.showModal()`/`.close()`) and
shows the full untruncated text — the tile itself only shows the title plus a `line-clamp-3`
description. The dialog needs an explicit `m-auto` or it renders pinned to the top-left:
Tailwind's Preflight zeroes `margin` globally, which strips the browser's default
`margin: auto` centering for `dialog:modal`.

**Never put a bare `display`-affecting utility (`flex`, `grid`, `block`, ...) directly on
a `<dialog>` element** — use the `open:` variant (e.g. `open:flex`) instead. A closed
`<dialog>` is hidden by the browser's own UA stylesheet (`dialog:not([open]) { display:
none }`), but author-origin CSS — which is exactly what a Tailwind utility class compiles
to — beats a UA stylesheet rule regardless of specificity. A bare `flex` class was added
to `Tile.tsx`'s dialog once for layout purposes and made every tile's modal permanently
visible (as an empty-looking box, on every grid, before any click), because it
unconditionally forced `display: flex` even without the `open` attribute. This is real
browser-cascade behavior that jsdom-based tests don't reliably catch — verify any
dialog-styling change with `docs/visual-verification.md`'s recipe, checking the page
right after load with nothing clicked, not just after opening it.

The checked toggle inside that dialog is Save/Cancel, not live-committing: a local
`draftChecked` state (seeded from the real committed value every time the dialog opens)
is what the `Switch` in the modal actually controls; only the "Save" button calls
`updateChecked`. Cancel, a backdrop click, and Escape all just close the dialog — none of
them touch real state, so the draft is discarded for free rather than needing explicit
revert logic. The tile's own passive styling (dimmed/`line-through` once checked) reads
the real committed value via `isChecked`, never the draft.

`PersonMenu.tsx` reuses that same `<dialog>` pattern but renders responsively: a bottom sheet
below `md` (`mt-auto`, `rounded-t-3xl`, `w-full max-w-none` — pinned to the bottom, the
opposite of `Tile`'s centered `m-auto`) and a centered modal at `md` and up (`md:m-auto`,
capped `md:max-w-md`, `md:rounded-2xl`). One `<dialog>`, responsive shell classes only — no
separate mobile/desktop components needed. See `docs/design-system.md` for the single-`md`-
breakpoint (768px) strategy this and `AppBar.tsx` both follow.

**Headless-Chrome viewport testing gotcha**: plain `google-chrome --headless --window-size=W,H
--screenshot=...` does NOT reliably lay out the page at `W` CSS pixels in this environment,
even though the output PNG is exactly `W×H` pixels — it can silently render at a different
internal width and crop/scale the result, which previously produced screenshots that looked
plausible but were measuring the wrong thing entirely (elements that should have been visible
at a given width appeared clipped or missing, and there was no way to tell from the image
alone). The reliable method is CDP: launch with `--remote-debugging-port`, then over the
websocket call `Emulation.setDeviceMetricsOverride({width, height, deviceScaleFactor: 1,
mobile: true})` *before* navigating, and use `Page.captureScreenshot` (or
`Runtime.evaluate` + `document.documentElement.clientWidth` to confirm the override actually
took) rather than the command-line `--screenshot` flag for anything narrower than a typical
desktop width.

**Automating clicks inside a `<dialog>` is unreliable in headless Chrome via CDP**
(`Runtime.evaluate`-driven `.click()`, and coordinate-based `Input.dispatchMouseEvent`) —
a checkbox inside a `showModal()`-opened dialog silently did nothing (no console error, no
state change) across multiple fresh browser profiles, while the same interaction worked
fine for a real person in a real browser. Root cause not fully pinned down (suspected to be
related to the dialog's "top layer" rendering and automated event dispatch), but the
practical takeaway: don't trust an automated-click test of `<dialog>` content in this
environment when it fails — verify manually before concluding the app itself is broken.

See `docs/visual-verification.md` for a copy-pasteable recipe (launch headless Chrome
with remote debugging, drive it over CDP) that avoids both gotchas above — reach for it
whenever a change needs an actual rendered check rather than rediscovering the same
websocket boilerplate from scratch.

Offline support is via `vite-plugin-pwa` (`vite.config.ts`), split into three lanes — see
`docs/backend-architecture.md` §9 for the full reasoning. The app shell (`index.html`, hashed
JS/CSS) is precached normally. Trip data (`grids/<slug>/<n>.json`, `data/<slug>/people.ts`,
lazy-loaded via `import.meta.glob` in `src/lib/trips.ts`) is deliberately excluded from precache
(`workbox.globIgnores`) and instead runtime-cached (`CacheFirst`) only once actually requested —
so visiting one trip doesn't pull every trip in the repo into the cache. This only works because
`chunkFileNames` in `vite.config.ts` routes those specific chunks into a `trip-data/` output
directory first — without that, they're indistinguishable by URL from ordinary app-shell JS
chunks, since Vite bundles JSON imports as JS, not as separately-fetchable `.json` requests. If a
new lazy-loaded, per-slug data source is ever added, it needs to go through this same
`chunkFileNames` routing (matched by its module path) or it'll silently get swept into the
precached app shell instead of the runtime-cached trip-data lane. The checked-state `GET` is the
third lane, `NetworkFirst` rather than `CacheFirst` — its content is mutable, unlike grid layout,
so freshness matters more than an instant cache hit; the last successful response is what's
served when offline.

The service worker's own `NavigationRoute` intercepts *any* navigation request (typing a URL,
following a link) within its scope and serves the cached app shell — client-side, before the
request ever reaches the network, so `vercel.json`'s SPA rewrite can't help here at all. Hit this
for real: navigating straight to `/api/health` in a browser rendered an empty page (the app
shell, with React Router matching no route for the two-segment path) instead of reaching the
function. Fixed with `workbox.navigateFallbackDenylist: [/^\/api\//]`, for the same underlying
reason the `vercel.json` rewrite needs its own `/api/` exclusion — two independent layers, each
capable of swallowing `/api/*` on its own, both need the exclusion.

`vercel.json` explicitly sets `Cache-Control: no-cache` on `/sw.js` and `/registerSW.js`
— the whole `registerType: "autoUpdate"` mechanism depends on the browser being able to
fetch a genuinely fresh copy of the service worker on each visit; if either file were
served with any real cache lifetime (Vercel's un-configured default for a static file is
not something to just assume is safe here), updates could silently stop reaching users
for as long as that cache lasts. This was never actually verified against Vercel's real
response headers before the headers were added — if you ever remove them, re-verify
against the live deployment, not just `vite preview`.

Per-cell "checked" state (`src/lib/checked.ts` + `src/context/CheckedContext.tsx`) is backed by
the real `GET`/`PATCH` API now (`docs/backend-architecture.md` §4/§9), not localStorage —
`Tile.tsx`/`TripPage.tsx` still only ever call `fetchChecked`/`saveChecked`/`useChecked`, never
`fetch` or the queue directly, exactly as the seam was designed to allow (`docs/plan.md`). The
toggle itself lives inside each cell's `<dialog>`, not on the tile — the tile stays a single
click target that opens the modal, and only passively reflects checked state (dimmed,
struck-through text).

Every write goes through `src/lib/checkedQueue.ts` — online or offline, there's no "if online,
PATCH directly" branch, so the `409`/`404`/`503` handling is written once. Three triggers drain
it (immediately after enqueueing, on mount, on the browser's `online` event), deliberately no
periodic polling and no manual "Resync" button — a stuck queue is visible via
`src/components/QueueStatus.tsx`'s "N updates queued" indicator, and the obvious response
(reload) is itself one of the three triggers.

Every localStorage key in this app is prefixed `bingo:` (`bingo:tintsEnabled`,
`bingo:checked:queue:<tripSlug>`) — keep using that prefix for anything new stored there, both to
namespace against other localStorage users on the same origin and to keep related keys grep-able
as a group. Checked-state itself no longer lives in localStorage at all — only the pending-write
queue does, and only until it drains.

## Conventions

- `.claude/rules/` holds deeper, path-scoped conventions that load automatically only when
  Claude touches matching files (keeps them out of every session's base context).
- `docs/` holds human-facing project docs (architecture, runbooks). Not auto-loaded by Claude.
- Non-trivial work happens on a `feat/<description>` branch off `main`, committing as it
  progresses, merged back into `main` locally with `git merge --no-ff` (a real merge commit,
  not a squash and not a fast-forward) once the feature's ready — keeps history essentially
  linear (one feature at a time) while still showing each feature's individual commits and an
  explicit "Merge branch 'feat/...' into main" marker. Delete the branch after it's merged.

## Read-only commands

`git status`, `git diff`, `git log`, `ls`, `cat`, `head`, `tail`, `grep`, `find` and similar are
already permitted by Claude Code by default — no permission rule needed for these. Only
test/lint/typecheck/format commands are pre-approved in `.claude/settings.json`; anything that
installs, pushes, or mutates state will still prompt.
