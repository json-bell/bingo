import fs from "fs/promises";
import path from "path";
import { events } from "../bingoes";
import { people } from "../people";
import { shirtNumbers } from "../shirtNumbers";
import { personToSong } from "../personToSong";
import { getDisneyGrids } from "../generateGrids";

// Dev/test-only runner: builds disney-2026's grids from the current (still
// placeholder-heavy) content and writes them out for manual inspection.
// Does NOT touch config/trips.json or the checked-state DB -- going live is
// a separate, deliberate step once content is real and the multi-slug path
// has been exercised (temp-prompt.md items #1/#3). Output is deliberately
// named outside createGrids.ts's real 1/2/3... versioning scheme so this
// never collides with (or gets mistaken for) a real promoted version.
//
// Usage: npx tsx data/disney-2026/scripts/generateGrids.ts

const grids = getDisneyGrids({
  events,
  people: [...people],
  songFromPerson: personToSong,
  shirtNumbers,
});

const gridsDir = path.join("grids", "disney-2026");
await fs.mkdir(gridsDir, { recursive: true });
const outputPath = path.join(gridsDir, "0-dev-preview.json");
await fs.writeFile(outputPath, JSON.stringify(grids, null, 2) + "\n");
console.log(`Wrote ${outputPath} (${grids.length} grids, ${grids[0]?.flat().length ?? 0} cells each).`);
