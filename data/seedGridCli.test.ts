import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { checked } from "../db/schema.js";
import { getDisneyGrids } from "./disney-2026/generateGrids";
import { people } from "./disney-2026/people";
import type { Person } from "./disney-2026/people";
import type { DisneyEvent } from "./disney-2026/bingoes";

// Exercises the real npm-run-seed-grid entry point (data/seedGridCli.ts) as
// an actual subprocess, not just the seedGrid() function it wraps -- the
// thing this project's CLAUDE.md describes as "the only seeding path." Runs
// against a disposable fixture slug (same pattern as
// data/generateDataFile.test.ts), never real trip content -- nothing here
// touches grids/disney-2026 or config/trips.json.
//
// Deliberately builds grids via getDisneyGrids() (the real make-grid
// pipeline's generator), not the older data/getGrids.ts, since this test is
// specifically about "two grids from an actual make-grid-shaped run" staying
// isolated in the database -- see data/disney-2026/generateGrids.test.ts for
// the same synthetic-filler-event pattern used here.
const FIXTURE_SLUG = "__vitest-fixture-seed-cli__";
const dataDir = path.join("data", FIXTURE_SLUG);
const gridsDir = path.join("grids", FIXTURE_SLUG);
const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");

function makeFiller(difficulty: "e" | "m" | "h", count: number, prefix: string): DisneyEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    summary: `${prefix}-${i}`,
    description: `Filler event ${prefix}-${i}`,
    difficulty,
  }));
}
function buildEvents(): DisneyEvent[] {
  return [...makeFiller("e", 15, "easy"), ...makeFiller("m", 15, "med"), ...makeFiller("h", 15, "hard")];
}

const songFromPerson: Record<Person, string> = Object.fromEntries(
  people.map((p) => [p, `${p}-song`])
) as Record<Person, string>;
const shirtNumbers: Record<Person, string> = Object.fromEntries(
  people.map((p, i) => [p, String(i + 1)])
) as Record<Person, string>;

function buildFixtureGrids() {
  // This test is about database persistence/isolation, not content balance
  // or difficulty distribution -- 0.5 keeps the balance check genuinely
  // exercised (unlike ratio: 0, which skips it outright) while staying
  // effectively risk-free against MAX_GENERATION_ATTEMPTS: with 45 filler
  // events and no guaranteed/variantGroup/eligiblePeople constraints, half
  // the pool appearing twice across 7 grids clears on the first attempt in
  // practice. See generateGrids.ts's MAX_GENERATION_ATTEMPTS comment for why
  // 0.99 (production's real ratio) is the one that actually needs margin.
  return getDisneyGrids({
    events: buildEvents(),
    people: [...people],
    songFromPerson,
    shirtNumbers,
    balanceMinAppearanceRatio: 0.5,
  });
}

async function writeFixtureGridVersion(version: number): Promise<ReturnType<typeof getDisneyGrids>> {
  const grids = buildFixtureGrids();
  await fs.mkdir(gridsDir, { recursive: true });
  await fs.writeFile(path.join(gridsDir, `${version}.json`), JSON.stringify(grids, null, 2) + "\n");
  return grids;
}

function runSeedGridCli(version: number): string {
  // Inherits process.env, which api/test/setup.ts has already pointed at
  // TEST_DATABASE_URL/DB_DRIVER=pg by the time any test body runs -- so this
  // seeds the real bingo_test database, the same one the direct seedGrid()
  // tests in data/seedGrid.test.ts assert against.
  return execFileSync(tsxBin, ["data/seedGridCli.ts", FIXTURE_SLUG, String(version)], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf-8",
  });
}

describe("seedGridCli (real CLI subprocess)", () => {
  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(gridsDir, { recursive: true, force: true });
  });

  it("seeds two grid versions of the same trip -- as if from two make-grid runs -- without either interfering with the other", async () => {
    // Three real tsx subprocess invocations, each paying tsx's cold-start
    // TypeScript transpile cost with no cache -- comfortably over Vitest's
    // 5s default.
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "people.ts"),
      `export const people = ${JSON.stringify(people)};\n`
    );

    const gridsV1 = await writeFixtureGridVersion(1);
    const gridsV2 = await writeFixtureGridVersion(2);

    const expectedRowCount = people.length * 25;
    const outputV1 = runSeedGridCli(1);
    const outputV2 = runSeedGridCli(2);

    expect(outputV1).toMatch(new RegExp(`Seeded ${expectedRowCount} checked rows into`));
    expect(outputV2).toMatch(new RegExp(`Seeded ${expectedRowCount} checked rows into`));

    const v1Rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, FIXTURE_SLUG), eq(checked.gridVersion, 1)));
    const v2Rows = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, FIXTURE_SLUG), eq(checked.gridVersion, 2)));

    expect(v1Rows).toHaveLength(expectedRowCount);
    expect(v2Rows).toHaveLength(expectedRowCount);

    const v1CellIds = new Set(gridsV1.flatMap((grid) => grid.flat().map((cell) => cell.id)));
    const v2CellIds = new Set(gridsV2.flatMap((grid) => grid.flat().map((cell) => cell.id)));
    expect(v1Rows.every((r) => v1CellIds.has(r.cellId))).toBe(true);
    expect(v2Rows.every((r) => v2CellIds.has(r.cellId))).toBe(true);
    for (const id of v1CellIds) expect(v2CellIds.has(id)).toBe(false);

    // Re-running seed-grid against v1's already-seeded file (the documented
    // retry path -- CLAUDE.md: "always re-run seed-grid ... never make-grid")
    // must stay idempotent and must not disturb v2's rows.
    const rerunOutput = runSeedGridCli(1);
    expect(rerunOutput).toMatch(new RegExp(`Seeded ${expectedRowCount} checked rows into`));

    const v1RowsAfterRerun = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, FIXTURE_SLUG), eq(checked.gridVersion, 1)));
    const v2RowsAfterRerun = await db
      .select()
      .from(checked)
      .where(and(eq(checked.tripSlug, FIXTURE_SLUG), eq(checked.gridVersion, 2)));
    expect(v1RowsAfterRerun).toHaveLength(expectedRowCount);
    expect(v2RowsAfterRerun).toEqual(v2Rows);
  }, 90000);
});
