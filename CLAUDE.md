# Project instructions for Claude Code

## Project overview

A single-page React app that renders bingo grids for group trips. Each trip is a "slug"
(e.g. `europapark-2024`) routed client-side at `/:slug` via `react-router-dom`; `/` lists
known slugs. Every slug has its own people list and its own numbered, pre-generated grid
files (`grids/<slug>/<n>.json`, built by `npm run make-grid`, not generated at runtime) —
`config/trips.json` says which numbered version is currently live for each slug. Deployed to
Vercel (`vercel.json` has the SPA catch-all rewrite it needs) — previously dragged `dist/`
into Vercel by hand, and briefly set up for GitHub Pages before switching back to Vercel for
proper path-based routing without a redirect trick.

## Commands

These are the real, verified commands for this repo. Don't guess alternatives (`yarn` vs `npm` vs `pnpm` etc.) — if a command below is wrong or missing, fix this section or prompt the user to fix it rather than trying variations.

| Task           | Command                                   |
| -------------- | ------------------------------------------ |
| Dev server     | `npm run dev`                             |
| Build          | `npm run build`                           |
| Preview build  | `npm run preview`                         |
| Lint           | `npm run lint -- --quiet`                 |
| Generate a new grid version for a slug | `npm run make-grid -- <slug>` (e.g. `europapark-2024`) |

`make-grid` reads `data/<slug>/bingoes.csv`, writes a new auto-numbered
`grids/<slug>/<n>.json` (never overwrites an existing version), and prints which
`config/trips.json` field to update to make it live. Promotion/rollback is just editing that
number in `config/trips.json` — no file renaming or manual promotion step.

**Lint is currently broken**: no `.eslintrc*` file exists in the repo despite ESLint 8 being
configured in `package.json`, so `npm run lint` fails with "ESLint couldn't find a
configuration file" regardless of the code. Don't treat lint failures as a sign your change
broke something until this is fixed — flag it to the user instead of working around it.

_If a quiet run fails or the output is unhelpfully sparse, drop the flag for that one invocation and re-run — quiet is the default, not a hard rule._

## Conventions

- `.claude/rules/` holds deeper, path-scoped conventions that load automatically only when
  Claude touches matching files (keeps them out of every session's base context).
- `docs/` holds human-facing project docs (architecture, runbooks). Not auto-loaded by Claude.

## Read-only commands

`git status`, `git diff`, `git log`, `ls`, `cat`, `head`, `tail`, `grep`, `find` and similar are
already permitted by Claude Code by default — no permission rule needed for these. Only
test/lint/typecheck/format commands are pre-approved in `.claude/settings.json`; anything that
installs, pushes, or mutates state will still prompt.
