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

Styling is Tailwind v4 (`@tailwindcss/vite`, wired into `vite.config.js`; `src/index.css` is
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

Colors are semantic design tokens defined once in `src/index.css`'s `@theme` block (the
"ticket stub at dusk" palette — `background`/`foreground` for the page, `surface` for cards,
`ink`/`ink-muted` for text on `surface`, `brand`/`secondary`/`accent` for brand accents,
`difficulty-easy`/`-medium`/`-hard` for grid tiles) — never reach for a raw `bg-[#hex]` or
`bg-[rgb(...)]` arbitrary value for anything that already has a semantic token; add a new
token instead if none of the existing ones fit. A background and its text color are a pair,
not independent choices — `ink` reads fine on `surface`/`difficulty-easy`/`difficulty-medium`,
but `difficulty-hard` is dark enough that it needs `foreground` (cream) text instead, and
`ink`, not `foreground`, is what has enough contrast against `secondary` (teal nav). Check
contrast (WCAG AA: 4.5:1 normal text, 3:1 for large/bold like headings) before pairing a new
background with a text color rather than assuming it'll work — the initial palette pass
shipped `ink-muted` on the difficulty tiles and it failed contrast on two of the three.

## Conventions

- `.claude/rules/` holds deeper, path-scoped conventions that load automatically only when
  Claude touches matching files (keeps them out of every session's base context).
- `docs/` holds human-facing project docs (architecture, runbooks). Not auto-loaded by Claude.

## Read-only commands

`git status`, `git diff`, `git log`, `ls`, `cat`, `head`, `tail`, `grep`, `find` and similar are
already permitted by Claude Code by default — no permission rule needed for these. Only
test/lint/typecheck/format commands are pre-approved in `.claude/settings.json`; anything that
installs, pushes, or mutates state will still prompt.
