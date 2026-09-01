# Bingo Grids

Renders bingo grids for group trips, one grid per person, at `/<slug>` (e.g.
`/europapark-2024`). `/` lists known trips. See `CLAUDE.md` for commands and
`.claude/rules/architecture.md` for how the pieces fit together.

## Adding a new grid version for an existing trip

1. Edit `data/<slug>/bingoes.csv` with the updated events.
2. Run `npm run make-grid -- <slug>`. This writes a new `grids/<slug>/<n>.json` — it never
   overwrites an existing version, so nothing is lost mid-iteration.
3. Seed the `checked` rows for that version: `npm run seed-grid -- <slug> <n>` (local) or
   `npm run seed-grid:prod -- <slug> <n>` (production) — `make-grid` only writes the JSON, it
   never seeds a database on its own.
4. Update `config/trips.json`'s `"<slug>".currentVersion` to `<n>` to make it live.

## Adding a new trip

Create `data/<slug>/{bingoes.csv,people.js,characters.js}` (see `data/europapark-2024/` for
the shape), then follow the same generate + config steps above.

Superseded CSV drafts live in `data/archive/<slug>/` — kept for reference, not part of the
build.
