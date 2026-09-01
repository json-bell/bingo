import fs from "fs/promises";
import path from "path";
import { events } from "../bingoes";
import { people } from "../people";
import { shirtNumbers } from "../shirtNumbers";
import { personToSong } from "../personToSong";
import { getDisneyGrids } from "../generateGrids";

// disney-2026's grid-generation entry point (npm run make-grid). Writes the
// local grid JSON only -- seeding is always a separate, deliberate step via
// npm run seed-grid / seed-grid:prod (docs/grid-content-pipeline.md,
// CLAUDE.md). Does not touch config/trips.json either; promoting a version
// live is a separate manual edit once content is ready.
//
// Usage: npm run make-grid

const grids = getDisneyGrids({
  events,
  people: [...people],
  songFromPerson: personToSong,
  shirtNumbers,
});

// Same never-overwrite auto-numbering as data/createGrids.ts's old pipeline,
// copied rather than shared -- see that file for the original. Small and
// stable enough (no trip-specific content at all) that duplicating it here
// was preferred over editing the archived script to extract a shared helper.
const gridsDir = path.join("grids", "disney-2026");
await fs.mkdir(gridsDir, { recursive: true });
const existing = await fs.readdir(gridsDir).catch(() => [] as string[]);
const versions = existing
  .map((f) => Number(f.replace(/\.json$/, "")))
  .filter((n) => Number.isInteger(n) && n > 0);
const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

await fs.writeFile(
  path.join(gridsDir, `${nextVersion}.json`),
  JSON.stringify(grids, null, 2) + "\n"
);
console.log(`Wrote grids/disney-2026/${nextVersion}.json`);
console.log();
console.log(`This only wrote the local JSON -- seeding is a separate, deliberate step:`);
console.log(`  npm run seed-grid -- disney-2026 ${nextVersion}       (local DATABASE_URL)`);
console.log(`  npm run seed-grid:prod -- disney-2026 ${nextVersion}  (production)`);
console.log();
console.log(
  `Then set config/trips.json's "disney-2026".currentVersion to ${nextVersion} to make it live.`
);
