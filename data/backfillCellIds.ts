import fs from "fs/promises";
import path from "path";
import type { BingoItem, Grid } from "../types/trip";

// One-off migration for a grid version that predates cell IDs (see
// docs/plan.md's "Cell IDs" section). Reads an existing grid file verbatim —
// no reshuffling, no re-reading the CSV — and writes a new numbered version
// with an id backfilled onto every cell, per the never-overwrite convention
// createGrids.ts already follows.

const [slug, fromVersionArg] = process.argv.slice(2);
if (!slug || !fromVersionArg) {
  console.error("Usage: tsx data/backfillCellIds.ts <slug> <fromVersion>");
  process.exit(1);
}
const fromVersion = Number(fromVersionArg);

const gridsDir = path.join("grids", slug);
const sourcePath = path.join(gridsDir, `${fromVersion}.json`);
const raw = await fs.readFile(sourcePath, "utf-8");
const grids: BingoItem[][][] = JSON.parse(raw);

const withIds: Grid[] = grids.map((grid) =>
  grid.map((row) => row.map((cell) => ({ ...cell, id: crypto.randomUUID() })))
);

const existing = await fs.readdir(gridsDir).catch(() => [] as string[]);
const versions = existing
  .map((f) => Number(f.replace(/\.json$/, "")))
  .filter((n) => Number.isInteger(n) && n > 0);
const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

await fs.writeFile(
  path.join(gridsDir, `${nextVersion}.json`),
  JSON.stringify(withIds, null, 2) + "\n"
);
console.log(`Wrote grids/${slug}/${nextVersion}.json (backfilled from version ${fromVersion}).`);
console.log(
  `Set config/trips.json's "${slug}".currentGrid to ${nextVersion} to make it live.`
);
