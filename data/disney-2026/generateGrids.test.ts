import { describe, it, expect } from "vitest";
import { getDisneyGrids } from "./generateGrids";
import { people } from "./people";
import type { Person } from "./people";
import { VariantGroup } from "./variantGroups";
import type { DisneyEvent } from "./bingoes";
import type { DisneySeedingInputs } from "./seedingInputs";

// Fixtures, not real disney-2026 content -- exercises generateGrids.ts's
// pool-building/positioning/resolution logic in isolation, per
// docs/grid-content-pipeline.md §10 ("unit-tested against typed mock
// BingoItem arrays entirely independent of whether real content is ready").

function makeFiller(difficulty: "e" | "m" | "h", count: number, prefix: string): DisneyEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    summary: `${prefix}-${i}`,
    description: `Filler event ${prefix}-${i}`,
    difficulty,
  }));
}

function buildEvents(overrides: Partial<Record<"e" | "m" | "h", DisneyEvent[]>> = {}): DisneyEvent[] {
  return [
    ...(overrides.e ?? makeFiller("e", 15, "easy")),
    ...(overrides.m ?? makeFiller("m", 15, "med")),
    ...(overrides.h ?? makeFiller("h", 15, "hard")),
  ];
}

const songFromPerson: Record<Person, string> = Object.fromEntries(
  people.map((p) => [p, `${p}-song`])
) as Record<Person, string>;
const shirtNumbers: Record<Person, string> = Object.fromEntries(
  people.map((p, i) => [p, String(i + 1)])
) as Record<Person, string>;

describe("getDisneyGrids", () => {
  it("produces one 5x5 grid per person with the standard 8/8/8/1 difficulty split", () => {
    const events = buildEvents();
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    expect(grids).toHaveLength(people.length);
    for (const grid of grids) {
      const cells = grid.flat();
      expect(cells).toHaveLength(25);
      const counts = { e: 0, m: 0, h: 0, f: 0 };
      cells.forEach((c) => counts[c.difficulty as keyof typeof counts]++);
      expect(counts).toEqual({ e: 8, m: 8, h: 8, f: 1 });
      expect(new Set(cells.map((c) => c.id)).size).toBe(25);
    }
  });

  it("never draws two members of the same variantGroup into one grid", () => {
    const events = buildEvents({
      e: [
        ...makeFiller("e", 15, "easy"),
        {
          summary: "breakdown A",
          description: "A",
          difficulty: "e",
          variantGroup: VariantGroup.RIDE_BREAKDOWN,
        },
        {
          summary: "breakdown B",
          description: "B",
          difficulty: "e",
          variantGroup: VariantGroup.RIDE_BREAKDOWN,
        },
      ],
    });
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    for (const grid of grids) {
      const summaries = grid.flat().map((c) => c.summary);
      expect(summaries.includes("breakdown A") && summaries.includes("breakdown B")).toBe(false);
    }
  });

  it("never draws two members of the same variantGroup across different difficulty tiers", () => {
    // Regression guard: the original implementation checked variantGroup
    // exclusivity independently per tier (each tier's own selection loop
    // only compared against itself), so a group split across two
    // difficulties -- like disney-2026's real FLIGHT_TIMING and MERCH
    // groups -- was never actually enforced. One member here is "e", the
    // other "m".
    const events = buildEvents({
      e: [
        ...makeFiller("e", 15, "easy"),
        { summary: "flight A", description: "A", difficulty: "e", variantGroup: VariantGroup.FLIGHT_TIMING },
      ],
      m: [
        ...makeFiller("m", 15, "med"),
        { summary: "flight B", description: "B", difficulty: "m", variantGroup: VariantGroup.FLIGHT_TIMING },
      ],
    });
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    for (const grid of grids) {
      const summaries = grid.flat().map((c) => c.summary);
      expect(summaries.includes("flight A") && summaries.includes("flight B")).toBe(false);
    }
  });

  it("never draws an eligiblePeople-restricted event onto an ineligible person's grid", () => {
    const [eligible] = people;
    const events = buildEvents({
      e: [
        ...makeFiller("e", 20, "easy"),
        { summary: "vip only", description: "vip", difficulty: "e", eligiblePeople: [eligible] },
      ],
    });
    // balanceMinAppearanceRatio: 0 -- eligiblePeople caps how many grids an
    // event could ever appear on (restricted to one person here, so at most
    // 1), which would otherwise conflict with whatever balance ratio
    // production happens to be tuned to. This test is about exclusion, not
    // balance, so it shouldn't be coupled to that setting at all.
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    grids.forEach((grid, i) => {
      if (people[i] === eligible) return;
      expect(grid.flat().some((c) => c.summary === "vip only")).toBe(false);
    });
  });

  it("includes an eligiblePeople-restricted event when the eligible pool leaves it no room to lose", () => {
    const [personA, personB] = people;
    // Every tier has exactly as many candidates as slots (8), and the
    // restricted event is eligible for both requested people -- so every
    // tier is a forced, fully-deterministic full-pool inclusion for both
    // grids (no lucky draw involved), and since both grids end up with the
    // identical 24-item pool, the cross-grid balance check passes trivially
    // too (every item appears on both grids).
    const events: DisneyEvent[] = [
      ...makeFiller("e", 7, "easy"),
      { summary: "vip only", description: "vip", difficulty: "e", eligiblePeople: [personA, personB] },
      ...makeFiller("m", 8, "med"),
      ...makeFiller("h", 8, "hard"),
    ];
    const grids = getDisneyGrids({ events, people: [personA, personB], songFromPerson, shirtNumbers });

    for (const grid of grids) {
      expect(grid.flat().some((c) => c.summary === "vip only")).toBe(true);
    }
  });

  it("places every guaranteed event on every grid, exactly once", () => {
    const events = buildEvents({
      e: [
        ...makeFiller("e", 7, "easy"),
        { summary: "always here", description: "x", difficulty: "e", guaranteed: true },
      ],
    });
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    for (const grid of grids) {
      expect(grid.flat().filter((c) => c.summary === "always here")).toHaveLength(1);
    }
  });

  it("never places two guaranteed events on the same row, column, or diagonal", () => {
    const events = buildEvents({
      e: [
        ...makeFiller("e", 7, "easy"),
        { summary: "guaranteed-e", description: "x", difficulty: "e", guaranteed: true },
      ],
      m: [
        ...makeFiller("m", 7, "med"),
        { summary: "guaranteed-m", description: "x", difficulty: "m", guaranteed: true },
      ],
      h: [
        ...makeFiller("h", 7, "hard"),
        { summary: "guaranteed-h", description: "x", difficulty: "h", guaranteed: true },
      ],
    });
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    for (const grid of grids) {
      const positions: [number, number][] = [];
      grid.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (["guaranteed-e", "guaranteed-m", "guaranteed-h"].includes(cell.summary)) {
            positions.push([r, c]);
          }
        })
      );
      expect(positions).toHaveLength(3);
      expect(new Set(positions.map(([r]) => r)).size).toBe(3);
      expect(new Set(positions.map(([, c]) => c)).size).toBe(3);
      expect(positions.filter(([r, c]) => r === c).length).toBeLessThanOrEqual(1);
      expect(positions.filter(([r, c]) => r + c === 4).length).toBeLessThanOrEqual(1);
    }
  });

  it("resolves a function-valued summary/description once per cell, shared between both fields", () => {
    const events: DisneyEvent[] = [
      ...makeFiller("e", 7, "easy"),
      {
        summary: (inputs: DisneySeedingInputs) => inputs.drinker,
        description: (inputs: DisneySeedingInputs) => `drinker was ${inputs.drinker}`,
        difficulty: "e",
      },
      ...makeFiller("m", 8, "med"),
      ...makeFiller("h", 8, "hard"),
    ];
    const grids = getDisneyGrids({
      events,
      people: [...people],
      songFromPerson,
      shirtNumbers,
      balanceMinAppearanceRatio: 0,
    });

    for (const grid of grids) {
      const cell = grid.flat().find((c) => c.description.startsWith("drinker was"));
      expect(cell).toBeDefined();
      // If summary/description were resolved independently instead of once
      // and shared, these could disagree.
      expect(cell?.description).toBe(`drinker was ${cell?.summary}`);
    }
  });

  it("throws a clear error when a difficulty tier doesn't have enough eligible events", () => {
    const events = buildEvents({ h: makeFiller("h", 5, "hard") });

    expect(() => getDisneyGrids({ events, people: [...people], songFromPerson, shirtNumbers })).toThrow(
      /not enough eligible "h"/i
    );
  });

  it("throws a clear error when a guaranteed event conflicts with its own eligiblePeople", () => {
    const [eligible, ineligible] = people;
    const events = buildEvents({
      e: [
        ...makeFiller("e", 7, "easy"),
        {
          summary: "conflict",
          description: "x",
          difficulty: "e",
          guaranteed: true,
          eligiblePeople: [eligible],
        },
      ],
    });

    expect(() => getDisneyGrids({ events, people: [ineligible], songFromPerson, shirtNumbers })).toThrow(
      /guaranteed.*eligiblePeople/i
    );
  });

  it("throws a clear error when a guaranteed event also has a variantGroup", () => {
    // Single-item data-authoring check, not a comparison against another
    // event -- "always included" and "one of a mutually-exclusive set" are
    // contradictory on the same item regardless of whether anything else
    // actually shares the group.
    const events = buildEvents({
      e: [
        ...makeFiller("e", 7, "easy"),
        {
          summary: "guaranteed but grouped",
          description: "x",
          difficulty: "e",
          guaranteed: true,
          variantGroup: VariantGroup.RIDE_BREAKDOWN,
        },
      ],
    });

    expect(() => getDisneyGrids({ events, people: [...people], songFromPerson, shirtNumbers })).toThrow(
      /guaranteed.*variantgroup/i
    );
  });

  it("throws instead of looping forever when guaranteed events can never avoid sharing a line", () => {
    // Every "e" position in the fixed 5x5 layout is guaranteed here -- two
    // of them ((0,1) and (0,3)) share row 0 no matter how the pool is
    // shuffled, so this can never be satisfied regardless of randomness.
    const events: DisneyEvent[] = [
      ...makeFiller("e", 8, "easy").map((e) => ({ ...e, guaranteed: true })),
      ...makeFiller("m", 8, "med"),
      ...makeFiller("h", 8, "hard"),
    ];

    expect(() =>
      getDisneyGrids({ events, people: [people[0]], songFromPerson, shirtNumbers })
    ).toThrow(/could not lay out guaranteed items/i);
  });
});
