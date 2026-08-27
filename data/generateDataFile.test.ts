import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { generateDataFile } from "./generateDataFile";

// generateDataFile reads/writes real paths under data/<slug>/ (no dependency
// injection for the path), so this exercises the real function against a
// disposable fixture slug rather than mocking fs — cleaned up in afterEach.
const FIXTURE_SLUG = "__vitest-fixture__";
const fixtureDir = path.join("data", FIXTURE_SLUG);

const CSV =
  [
    ", ,,",
    "Category,difficulty,summary,description",
    ",,,",
    "travel,e,flight on time,Flight is on time",
    "travel,m,airport pat down,Someone gets a pat down",
    "travel,h,throw up,Someone throws up",
    ",,,",
    "notes,not a difficulty,x,y",
  ].join("\r\n") + "\r\n";

describe("generateDataFile", () => {
  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it("parses valid rows and drops the header/trailer junk", async () => {
    await fs.mkdir(fixtureDir, { recursive: true });
    await fs.writeFile(path.join(fixtureDir, "bingoes.csv"), CSV);

    await generateDataFile(FIXTURE_SLUG);

    // Read the written module's source directly rather than importing it —
    // the path is only known at runtime (a disposable fixture slug), and
    // Vite's dynamic-import analysis needs a statically-resolvable specifier.
    const written = await fs.readFile(path.join(fixtureDir, "data.ts"), "utf-8");
    const marker = "BingoItem[] } = ";
    const jsonStart = written.indexOf(marker) + marker.length;
    const data = JSON.parse(written.slice(jsonStart, written.lastIndexOf("}") + 1)) as {
      rows: unknown[];
    };

    expect(data.rows).toEqual([
      { type: "travel", difficulty: "e", summary: "flight on time", description: "Flight is on time" },
      { type: "travel", difficulty: "m", summary: "airport pat down", description: "Someone gets a pat down" },
      { type: "travel", difficulty: "h", summary: "throw up", description: "Someone throws up" },
    ]);
  });
});
