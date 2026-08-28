import fs from "fs/promises";
import path from "path";
import { seedGrid, dbLabel } from "./seedGrid";
import type { Grid } from "../types/trip";

// The only safe retry path after a failed seed -- see
// docs/backend-architecture.md §5. Re-running `make-grid` does NOT retry:
// makeGrid() is unseeded-random and never overwrites, so a second run mints
// an entirely new version with a different set of cell ids, orphaning the
// grid file that already exists. This reads the already-written grid file
// and re-seeds from it instead of generating anything new.
const slug = process.argv[2];
const versionArg = process.argv[3];
if (!slug || !versionArg) {
  console.error("Usage: npm run seed-grid -- <slug> <version>");
  process.exit(1);
}
const version = Number(versionArg);
if (!Number.isInteger(version) || version <= 0) {
  console.error(`Invalid version: ${versionArg}`);
  process.exit(1);
}

const grids = JSON.parse(
  await fs.readFile(path.join("grids", slug, `${version}.json`), "utf-8")
) as Grid[];
const { people } = (await import(`./${slug}/people.ts`)) as { people: string[] };

const seeded = await seedGrid(slug, version, grids, people);
console.log(`Seeded ${seeded} checked rows into ${dbLabel()}.`);
