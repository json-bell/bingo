import type { Grid, GridCell } from "../../types/trip";
import { difficultyKey, shuffleObjectArray } from "../getGrids";
import type { DisneyEvent } from "./bingoes";
import type { DisneySeedingInputs } from "./seedingInputs";
import type { Person } from "./people";

// disney-2026's grid-building pipeline (docs/grid-content-pipeline.md §5-9).
// Deliberately separate from data/getGrids.ts's makeGrid() for now -- see
// data/disney-2026/bingoes.ts's header comment for why DisneyEvent isn't
// merged into the shared BingoItem/GridCell types yet.

const MAX_GENERATION_ATTEMPTS = 600;
// Empirically, with 3 guaranteed items spread one-per-tier (8 candidate
// positions each), only ~17% of random combinations avoid a shared
// row/column/diagonal -- 20 attempts (the original estimate) has a ~15%
// chance of falsely exhausting across a 7-grid trip on bad luck alone, not
// because the layout is actually impossible. 100 attempts is still
// effectively free (each check is a handful of comparisons) and drops that
// to statistically zero while still leaving the "truly impossible" case
// (e.g. too many guaranteed items for the layout to ever satisfy) able to
// throw.
const MAX_POSITIONING_ATTEMPTS = 100;
const SLOTS_PER_TIER = 8;
// At least this fraction of pool events must appear at least twice across
// all 7 grids, or the whole generation is rejected and retried. Placeholder
// policy (docs/grid-content-pipeline.md §9's example rule) -- revisit once
// real content/pool sizes are final.
const BALANCE_MIN_APPEARANCE_RATIO = 0.99;

type EventDifficulty = "e" | "m" | "h";

interface IndexedEvent {
  event: DisneyEvent;
  sourceIndex: number;
}

type Tiers = Record<EventDifficulty, IndexedEvent[]>;

// Priority order for resolving cross-tier (and same-tier) variantGroup
// duplicates: whichever candidate is encountered first in this order --
// index ascending, hard before medium before easy at each index -- survives;
// any later duplicate is dropped before either tier is ever trimmed to 8.
// This is deliberately done between shuffling and slicing to 8, never after
// -- resolving duplicates against a pre-trimmed 8 would mean the tier that
// loses one has nothing left to backfill from without a separate mechanism.
const GROUP_PRIORITY: EventDifficulty[] = ["h", "m", "e"];

function selectAllTiers(pool: Tiers, gridOwner: Person): Tiers {
  const seenGroups = new Set<string>();

  // Guaranteed items first, regardless of shuffle -- always kept. A
  // guaranteed event can't also have a variantGroup: "always included" and
  // "one of a mutually-exclusive set" are contradictory on the same item,
  // so this is a single-item data-authoring check, not a comparison against
  // any other event.
  const guaranteed: Tiers = { e: [], m: [], h: [] };
  for (const difficulty of GROUP_PRIORITY) {
    for (const item of pool[difficulty]) {
      if (!item.event.guaranteed) continue;
      if (
        item.event.eligiblePeople &&
        !item.event.eligiblePeople.includes(gridOwner)
      ) {
        throw new Error(
          `A guaranteed "${difficulty}" event is also restricted to eligiblePeople not including ${gridOwner} -- guaranteed and eligiblePeople can't conflict.`
        );
      }
      if (item.event.variantGroup) {
        throw new Error(
          `A guaranteed "${difficulty}" event can't also have a variantGroup ("${item.event.variantGroup}") -- guaranteed means always included, which conflicts with being one of a mutually-exclusive set.`
        );
      }
      guaranteed[difficulty].push(item);
    }
  }

  // Eligible, non-guaranteed candidates, shuffled per tier -- the full pool,
  // not trimmed to 8 yet.
  const candidates: Tiers = { e: [], m: [], h: [] };
  for (const difficulty of GROUP_PRIORITY) {
    const eligible = pool[difficulty].filter(
      (item) =>
        !item.event.guaranteed &&
        (!item.event.eligiblePeople ||
          item.event.eligiblePeople.includes(gridOwner))
    );
    candidates[difficulty] = shuffleObjectArray(eligible);
  }

  // Walk the merged priority order once: keep the first occurrence of each
  // variantGroup, drop the rest. A group-less item is always kept.
  const kept: Tiers = { e: [], m: [], h: [] };
  const maxLen = Math.max(
    candidates.e.length,
    candidates.m.length,
    candidates.h.length
  );
  for (let i = 0; i < maxLen; i++) {
    for (const difficulty of GROUP_PRIORITY) {
      const item = candidates[difficulty][i];
      if (!item) continue;
      const group = item.event.variantGroup;
      if (group) {
        if (seenGroups.has(group)) continue;
        seenGroups.add(group);
      }
      kept[difficulty].push(item);
    }
  }

  const result: Tiers = { e: [], m: [], h: [] };
  for (const difficulty of GROUP_PRIORITY) {
    const need = SLOTS_PER_TIER - guaranteed[difficulty].length;
    const filled = [
      ...guaranteed[difficulty],
      ...kept[difficulty].slice(0, need)
    ];
    if (filled.length < SLOTS_PER_TIER) {
      const message = `Not enough eligible "${difficulty}" events for ${gridOwner}'s grid (have ${filled.length}, need ${SLOTS_PER_TIER}) -- add more content, or loosen eligibility/variant-group restrictions.`;
      console.error(message);
      throw new Error(message);
    }
    result[difficulty] = filled;
  }
  return result;
}

function computePositionsByDifficulty(): Record<
  EventDifficulty,
  [number, number][]
> {
  const positions: Record<EventDifficulty, [number, number][]> = {
    e: [],
    m: [],
    h: []
  };
  difficultyKey.forEach((row, r) =>
    row.forEach((d, c) => {
      if (d !== "f") positions[d as EventDifficulty].push([r, c]);
    })
  );
  return positions;
}

const positionsByDifficulty = computePositionsByDifficulty();

function hasLineCollision(cells: [number, number][]): boolean {
  const counts = new Map<string, number>();
  for (const [r, c] of cells) {
    const keys = [`r${r}`, `c${c}`];
    if (r === c) keys.push("diag-main");
    if (r + c === 4) keys.push("diag-anti");
    for (const key of keys) {
      const next = (counts.get(key) ?? 0) + 1;
      if (next > 1) return true;
      counts.set(key, next);
    }
  }
  return false;
}

function guaranteedLocations(tiers: Tiers): [number, number][] {
  const locations: [number, number][] = [];
  (["e", "m", "h"] as const).forEach((difficulty) => {
    tiers[difficulty].forEach(({ event }, index) => {
      if (event.guaranteed)
        locations.push(positionsByDifficulty[difficulty][index]);
    });
  });
  return locations;
}

function positionGuaranteedItems(tiers: Tiers): Tiers {
  let current = tiers;
  for (let attempt = 1; attempt <= MAX_POSITIONING_ATTEMPTS; attempt++) {
    if (!hasLineCollision(guaranteedLocations(current))) {
      if (attempt > 1) {
        console.log(
          `  Positioned guaranteed items (attempt ${attempt}/${MAX_POSITIONING_ATTEMPTS})`
        );
      }
      return current;
    }
    current = {
      e: shuffleObjectArray(current.e),
      m: shuffleObjectArray(current.m),
      h: shuffleObjectArray(current.h)
    };
  }
  throw new Error(
    `Could not lay out guaranteed items without sharing a row/column/diagonal after ${MAX_POSITIONING_ATTEMPTS} attempts -- likely too many guaranteed items for the grid layout to ever satisfy.`
  );
}

function resolveEvent(
  event: DisneyEvent,
  gridOwner: Person,
  tripPeople: Person[],
  songFromPerson: Record<Person, string>,
  shirtNumbers: Record<Person, string>
): { summary: string; description: string } {
  const needsInputs =
    typeof event.summary === "function" ||
    typeof event.description === "function";
  if (!needsInputs) {
    return {
      summary: event.summary as string,
      description: event.description as string
    };
  }
  const inputs: DisneySeedingInputs = {
    gridOwner,
    drinker: Math.random() < 0.5 ? "Ben" : "Jason",
    randomPerson: tripPeople[Math.floor(Math.random() * tripPeople.length)],
    song: songFromPerson[gridOwner],
    shirtNumber: shirtNumbers[gridOwner]
  };
  return {
    summary:
      typeof event.summary === "function"
        ? event.summary(inputs)
        : event.summary,
    description:
      typeof event.description === "function"
        ? event.description(inputs)
        : event.description
  };
}

function buildGridForPerson(
  pool: Tiers,
  gridOwner: Person,
  tripPeople: Person[],
  songFromPerson: Record<Person, string>,
  shirtNumbers: Record<Person, string>
): { grid: Grid; sourceIndices: number[] } {
  console.log(`Generating ${gridOwner}'s grid...`);
  const tiers = selectAllTiers(pool, gridOwner);
  const positioned = positionGuaranteedItems(tiers);
  const index = { e: 0, m: 0, h: 0 };
  const sourceIndices: number[] = [];

  const grid: Grid = difficultyKey.map((row) =>
    row.map((difficulty): GridCell => {
      if (difficulty === "f") {
        return {
          difficulty: "f",
          summary: "free",
          description: "free",
          id: crypto.randomUUID()
        };
      }
      const tierDifficulty = difficulty as EventDifficulty;
      const { event, sourceIndex } =
        positioned[tierDifficulty][index[tierDifficulty]++];
      sourceIndices.push(sourceIndex);
      const resolved = resolveEvent(
        event,
        gridOwner,
        tripPeople,
        songFromPerson,
        shirtNumbers
      );
      return {
        difficulty: event.difficulty,
        ...resolved,
        id: crypto.randomUUID()
      };
    })
  );

  return { grid, sourceIndices };
}

// Diagnostic only -- doesn't feed into checkBalance's pass/fail decision.
// Guaranteed events are excluded: they always appear on all 7 grids by
// construction, so including them just pads the "appeared often" end with
// entries that were never actually subject to randomness. Split by
// difficulty rather than one merged histogram, since the tiers have very
// different pool sizes right now (10/25/14) -- a merged histogram would
// make E look artificially healthy and M artificially thin for reasons
// that are just pool-size math, not actual balance.
function logDistribution(
  events: DisneyEvent[],
  counts: number[],
  maxCount: number
): void {
  const byDifficulty: Record<EventDifficulty, number[]> = {
    e: [],
    m: [],
    h: []
  };
  const sparse: { difficulty: EventDifficulty; name: string; count: number }[] =
    [];

  events.forEach((event, i) => {
    // if (event.guaranteed) return;
    byDifficulty[event.difficulty].push(counts[i]);
    if (counts[i] <= 1) {
      sparse.push({
        difficulty: event.difficulty,
        name:
          typeof event.summary === "string"
            ? event.summary
            : "(templated summary)",
        count: counts[i]
      });
    }
  });

  const histograms: Record<EventDifficulty, Map<number, number>> = {
    e: new Map(),
    m: new Map(),
    h: new Map()
  };
  for (const difficulty of GROUP_PRIORITY) {
    for (const count of byDifficulty[difficulty]) {
      histograms[difficulty].set(
        count,
        (histograms[difficulty].get(count) ?? 0) + 1
      );
    }
  }

  // Table formatting: each column's content is 2 chars wide with 2 spaces
  // of padding on each side; "." marks a zero cell rather than "0", so
  // sparse spots in the table are visually distinct from real small counts
  // at a glance.
  const WIDTH = 2;
  const PADDING = 2;
  const cell = (content: string): string =>
    " ".repeat(PADDING) + content.padStart(WIDTH) + " ".repeat(PADDING);
  const segment = "-".repeat(WIDTH + PADDING * 2);
  const columns: EventDifficulty[] = ["e", "m", "h"];

  console.log(`  |${cell("#")}|${columns.map((d) => cell(d)).join("|")}|`);
  console.log(`  |${segment}|${columns.map(() => segment).join("|")}|`);
  for (let count = 0; count <= maxCount; count++) {
    const row = columns
      .map((d) => histograms[d].get(count) ?? 0)
      .map((n) => cell(n === 0 ? "." : String(n)));
    console.log(`  |${cell(String(count))}|${row.join("|")}|`);
  }

  if (sparse.length) {
    const sorted = [...sparse].sort(
      (a, b) =>
        a.count - b.count ||
        columns.indexOf(a.difficulty) - columns.indexOf(b.difficulty)
    );
    console.log("  Appeared 0 or 1 times:");
    for (const s of sorted) {
      console.log(`    - ${s.count} times: ${s.name} (${s.difficulty})`);
    }
  }
}

// minRatio <= 0 disables balance checking entirely (including the
// zero-appearances hard fail below) -- the escape hatch for callers that
// don't care about balance, e.g. structural/mechanism tests that shouldn't
// be coupled to whatever ratio production happens to be tuned to.
function checkBalance(counts: number[], minRatio: number): { ok: boolean; reason?: string } {
  if (minRatio <= 0) return { ok: true };
  const neverAppearing = counts.some((c) => c === 0);
  if (neverAppearing)
    return { ok: false, reason: "❌ At least one event never appeared" };
  const appearingAtLeastTwice = counts.filter((c) => c >= 2).length;
  const ratio = counts.length ? appearingAtLeastTwice / counts.length : 1;
  if (ratio < minRatio) {
    return {
      ok: false,
      reason: `❌ ${(100 - ratio * 100).toFixed(0)}% of events (${counts.length - appearingAtLeastTwice} of ${counts.length}) appeared only once across all grids (needs ${
        minRatio * 100
      }%)`
    };
  }
  console.log(
    `✅ Succeeded with ${(ratio * 100).toFixed(0)}% of events appearing at least twice (needed ${
      minRatio * 100
    }%`
  );
  return { ok: true };
}

export function getDisneyGrids({
  events,
  people: tripPeople,
  songFromPerson,
  shirtNumbers,
  balanceMinAppearanceRatio = BALANCE_MIN_APPEARANCE_RATIO
}: {
  events: DisneyEvent[];
  people: Person[];
  songFromPerson: Record<Person, string>;
  shirtNumbers: Record<Person, string>;
  balanceMinAppearanceRatio?: number;
}): Grid[] {
  const indexed: IndexedEvent[] = events.map((event, sourceIndex) => ({
    event,
    sourceIndex
  }));
  const pool: Tiers = {
    e: indexed.filter((e) => e.event.difficulty === "e"),
    m: indexed.filter((e) => e.event.difficulty === "m"),
    h: indexed.filter((e) => e.event.difficulty === "h")
  };

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const built = tripPeople.map((person) =>
      buildGridForPerson(pool, person, tripPeople, songFromPerson, shirtNumbers)
    );
    const counts = new Array(events.length).fill(0) as number[];
    for (const { sourceIndices } of built) {
      for (const idx of sourceIndices) counts[idx]++;
    }
    const balance = checkBalance(counts, balanceMinAppearanceRatio);
    console.log(
      `[disney-2026] generation attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${
        balance.ok ? "passed" : "failed"
      }${balance.reason ? ` (${balance.reason})` : ""}`
    );
    logDistribution(events, counts, tripPeople.length);
    if (balance.ok) return built.map((b) => b.grid);
  }
  throw new Error(
    `Failed to produce a balanced set of grids after ${MAX_GENERATION_ATTEMPTS} attempts.`
  );
}
