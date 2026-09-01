# Bingo Grids

Renders bingo grids for group trips, one grid per person, at `/<slug>` (e.g.
`/europapark-2024`). `/` lists known trips. See `CLAUDE.md` for commands and
`.claude/rules/architecture.md` for how the pieces fit together.

## Generating a new grid version

Two separate pipelines — see `docs/grid-content-pipeline.md` for why, `CLAUDE.md` for full
command details.

**disney-2026 (current)**: edit `data/disney-2026/bingoes.ts`, then:

1. Run `npm run make-grid`. Writes a new `grids/disney-2026/<n>.json` — never overwrites an
   existing version.
2. Seed the `checked` rows: `npm run seed-grid -- disney-2026 <n>` (local) or `npm run
   seed-grid:prod -- disney-2026 <n>` (production) — `make-grid` only writes the JSON, it
   never seeds a database on its own.
3. Update `config/trips.json`'s `"disney-2026".currentVersion` to `<n>` to make it live.

**europapark-2024 (archived CSV pipeline)**: edit `data/europapark-2024/bingoes.csv`, then run
`npm run make-grid:europapark-2024` in place of step 1 above (same seed/promote steps, with
`europapark-2024` as the slug). Not actively developed — kept working because the existing
trip depends on it, but no new trip should follow this pattern; see
`csv-grid-pipeline-notes.md` for its real limitations.

## Adding a new trip

Follow disney-2026's shape (`data/disney-2026/`) — a hand-authored TS array of events
(`bingoes.ts`), typed against the trip's own `people.ts`/`seedingInputs.ts`/`variantGroups.ts`
— not the archived CSV pattern. See `docs/grid-content-pipeline.md` for the full design.

Superseded CSV drafts (europapark-2024 only) live in `data/archive/<slug>/` — kept for
reference, not part of the build.
