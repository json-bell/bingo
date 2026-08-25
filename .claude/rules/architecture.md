---
paths:
  - "src/**"
---

## Architecture notes

- Slug routing: `App.jsx` is just a route table (`/` → `Home`, `/:slug` → `TripPage`).
  `TripPage.jsx` reads `:slug` from the URL and calls `lib/trips.js`'s `loadTrip(slug)`,
  which uses `import.meta.glob` over `grids/*/*.json` and `data/*/people.js` to lazy-load
  the right files at runtime (each slug's data ships as its own chunk — visiting one slug
  never pulls in another's). Adding a new slug is data + one `config/trips.json` line, no
  code changes.
- `config/trips.json` (shape: `{ "<slug>": { "currentGrid": <n> } }`) is the *only* place
  "which grid version is live" is decided. Every `npm run make-grid -- <slug>` run writes a
  new auto-numbered `grids/<slug>/<n>.json` and never overwrites an existing one — promoting
  or rolling back a version is just editing the number in this file, no renaming step.
- Grid layout (which difficulty goes in which of the 25 cells, the "jersey number" and
  "free" special cells) is generator-side logic in `data/getGrids.js` (pure — takes
  `{data, characters, people, number}`) and `data/createGrids.js` (CLI: reads
  `data/<slug>/{bingoes.csv,characters.js,people.js}`, writes the next numbered grid file),
  not anything in `src/`. If a grid looks wrong, that's where to look — the React
  components only render whatever shape they're handed.
