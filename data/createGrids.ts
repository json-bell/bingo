import fs from "fs/promises";
import path from "path";
import { generateDataFile } from "./generateDataFile";
import { getGrids } from "./getGrids";
import { seedGrid, dbLabel } from "./seedGrid";
import type { BingoItem, Grid } from "../types/trip";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run make-grid -- <slug>");
  process.exit(1);
}

await generateDataFile(slug);
const { data } = (await import(`./${slug}/data.ts`)) as {
  data: { rows: BingoItem[] };
};
const { characters } = (await import(`./${slug}/characters.ts`)) as {
  characters: string[];
};
const { people } = (await import(`./${slug}/people.ts`)) as {
  people: string[];
};

const gridsDir = path.join("grids", slug);
await fs.mkdir(gridsDir, { recursive: true });
const existing = await fs.readdir(gridsDir).catch(() => [] as string[]);
const versions = existing
  .map((f) => Number(f.replace(/\.json$/, "")))
  .filter((n) => Number.isInteger(n) && n > 0);
const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

const grids: Grid[] = getGrids({
  data,
  characters,
  people,
  number: people.length,
});
await fs.writeFile(
  path.join(gridsDir, `${nextVersion}.json`),
  JSON.stringify(grids, null, 2) + "\n"
);
console.log(`Wrote grids/${slug}/${nextVersion}.json`);

try {
  const seeded = await seedGrid(slug, nextVersion, grids, people);
  console.log(`Seeded ${seeded} checked rows into ${dbLabel()}.`);
} catch (error) {
  console.error(`Grid file written, but seeding failed:`, error);
  console.error(`Re-run: npm run seed-grid -- ${slug} ${nextVersion}`);
  process.exitCode = 1;
}

console.log(
  `Set config/trips.json's "${slug}".currentVersion to ${nextVersion} to make it live.`
);
