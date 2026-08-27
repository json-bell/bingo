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

Shared data-structure types (`BingoItem`, `Difficulty`, `Grid`, `TripConfig`, `LoadedTrip`)
live in `types/trip.ts` at the repo root, imported by both `src/` (the app, browser/DOM
context) and `data/` (the Node generator scripts) — it's the one place those shapes are
defined, don't redeclare them locally in either.

## Commands

These are the real, verified commands for this repo. Don't guess alternatives (`yarn` vs `npm` vs `pnpm` etc.) — if a command below is wrong or missing, fix this section or prompt the user to fix it rather than trying variations.

| Task           | Command                                   |
| -------------- | ------------------------------------------ |
| Dev server     | `npm run dev`                             |
| Build          | `npm run build` (runs `tsc -b` first — build fails on type errors, not just bundling errors) |
| Typecheck only | `npm run tscheck`                         |
| Preview build  | `npm run preview`                         |
| Lint           | `npm run lint -- --quiet`                 |
| Generate a new grid version for a slug | `npm run make-grid -- <slug>` (e.g. `europapark-2024`) |

`make-grid` runs `data/createGrids.ts` via `tsx` (not `node` — these are `.ts` files, not
compiled ahead of time). It reads `data/<slug>/bingoes.csv`, writes a new auto-numbered
`grids/<slug>/<n>.json` (never overwrites an existing version), and prints which
`config/trips.json` field to update to make it live. Promotion/rollback is just editing that
number in `config/trips.json` — no file renaming or manual promotion step.

Superseded CSV drafts go in `data/archive/<slug>/`, not `data/<slug>/` — keeps them
accessible without digging through git history, without cluttering the directory the
generator actually reads from.

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
apply (see `BingoItem.tsx`'s `bgClass` for the pattern: pick one string, don't concatenate).

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

`BingoItem.tsx`'s tile is clickable (native `<dialog>` + `ref`, `.showModal()`/`.close()`) and
shows the full untruncated text — the tile itself only shows the title plus a `line-clamp-3`
description. The dialog needs an explicit `m-auto` or it renders pinned to the top-left:
Tailwind's Preflight zeroes `margin` globally, which strips the browser's default
`margin: auto` centering for `dialog:modal`.

`PersonMenu.tsx` reuses that same `<dialog>` pattern but renders responsively: a bottom sheet
below `md` (`mt-auto`, `rounded-t-3xl`, `w-full max-w-none` — pinned to the bottom, the
opposite of `BingoItem`'s centered `m-auto`) and a centered modal at `md` and up (`md:m-auto`,
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

Offline support is via `vite-plugin-pwa` (`vite.config.ts`), split into two lanes — see
`docs/plan.md` for the full reasoning and the checked-state roadmap this was built to leave room
for. The app shell (`index.html`, hashed JS/CSS) is precached normally. Trip data
(`grids/<slug>/<n>.json`, `data/<slug>/people.ts`, lazy-loaded via `import.meta.glob` in
`src/lib/trips.ts`) is deliberately excluded from precache (`workbox.globIgnores`) and instead
runtime-cached (`CacheFirst`) only once actually requested — so visiting one trip doesn't
pull every trip in the repo into the cache. This only works because `chunkFileNames` in
`vite.config.ts` routes those specific chunks into a `trip-data/` output directory first —
without that, they're indistinguishable by URL from ordinary app-shell JS chunks, since
Vite bundles JSON imports as JS, not as separately-fetchable `.json` requests. If a new
lazy-loaded, per-slug data source is ever added, it needs to go through this same
`chunkFileNames` routing (matched by its module path) or it'll silently get swept into the
precached app shell instead of the runtime-cached trip-data lane.

## Conventions

- `.claude/rules/` holds deeper, path-scoped conventions that load automatically only when
  Claude touches matching files (keeps them out of every session's base context).
- `docs/` holds human-facing project docs (architecture, runbooks). Not auto-loaded by Claude.

## Read-only commands

`git status`, `git diff`, `git log`, `ls`, `cat`, `head`, `tail`, `grep`, `find` and similar are
already permitted by Claude Code by default — no permission rule needed for these. Only
test/lint/typecheck/format commands are pre-approved in `.claude/settings.json`; anything that
installs, pushes, or mutates state will still prompt.
