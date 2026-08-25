import fs from "fs/promises";
import path from "path";
import { generateDataFile } from "./getData.js";
import { getGrids } from "./getGrids.js";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run make-grid -- <slug>");
  process.exit(1);
}

await generateDataFile(slug);
const { data } = await import(`./${slug}/data.js`);
const { characters } = await import(`./${slug}/characters.js`);
const { people } = await import(`./${slug}/people.js`);

const gridsDir = path.join("grids", slug);
await fs.mkdir(gridsDir, { recursive: true });
const existing = await fs.readdir(gridsDir).catch(() => []);
const versions = existing
  .map((f) => Number(f.replace(/\.json$/, "")))
  .filter((n) => Number.isInteger(n) && n > 0);
const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

const grids = getGrids({ data, characters, people, number: people.length });
await fs.writeFile(
  path.join(gridsDir, `${nextVersion}.json`),
  JSON.stringify(grids, null, 2) + "\n"
);
console.log(`Wrote grids/${slug}/${nextVersion}.json`);
console.log(
  `Set config/trips.json's "${slug}".currentGrid to ${nextVersion} to make it live.`
);
