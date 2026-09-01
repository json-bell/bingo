import type { Grid, GridCell } from "../../types/trip";
import { difficultyKey, shuffleObjectArray } from "../getGrids";
import type { DisneyEvent } from "./bingoes";
import type { DisneySeedingInputs } from "./seedingInputs";
import { people } from "./people";
import type { Person } from "./people";

// disney-2026's grid-building pipeline (docs/grid-content-pipeline.md §5-9).
// Deliberately separate from data/getGrids.ts's makeGrid() for now -- see
// data/disney-2026/bingoes.ts's header comment for why DisneyEvent isn't
// merged into the shared BingoItem/GridCell types yet.

const MAX_GENERATION_ATTEMPTS = 5;
const MAX_POSITIONING_ATTEMPTS = 20;
const SLOTS_PER_TIER = 8;
// At least this fraction of pool events must appear at least twice across
// all 7 grids, or the whole generation is rejected and retried. Placeholder
// policy (docs/grid-content-pipeline.md §9's example rule) -- revisit once
// real content/pool sizes are final.
const BALANCE_MIN_APPEARANCE_RATIO = 0.7;

type EventDifficulty = "e" | "m" | "h";

interface IndexedEvent {
  event: DisneyEvent;
  sourceIndex: number;
}

type Tiers = Record<EventDifficulty, IndexedEvent[]>;

function canAdd(candidate: IndexedEvent, selected: IndexedEvent[], gridOwner: Person): boolean {
  const { eligiblePeople, variantGroup } = candidate.event;
  if (eligiblePeople && !eligiblePeople.includes(gridOwner)) return false;
  if (variantGroup && selected.some((s) => s.event.variantGroup === variantGroup)) return false;
  return true;
}

function selectTierItems(
  pool: IndexedEvent[],
  gridOwner: Person,
  difficulty: EventDifficulty
): IndexedEvent[] {
  const guaranteed = pool.filter((e) => e.event.guaranteed);
  for (const { event } of guaranteed) {
    if (event.eligiblePeople && !event.eligiblePeople.includes(gridOwner)) {
      throw new Error(
        `A guaranteed "${difficulty}" event is also restricted to eligiblePeople not including ${gridOwner} -- guaranteed and eligiblePeople can't conflict.`
      );
    }
  }

  const selected: IndexedEvent[] = [...guaranteed];
  const candidates = shuffleObjectArray(pool.filter((e) => !e.event.guaranteed));
  for (const candidate of candidates) {
    if (selected.length >= SLOTS_PER_TIER) break;
    if (canAdd(candidate, selected, gridOwner)) selected.push(candidate);
  }

  if (selected.length < SLOTS_PER_TIER) {
    throw new Error(
      `Not enough eligible "${difficulty}" events for ${gridOwner}'s grid (have ${selected.length}, need ${SLOTS_PER_TIER}) -- add more content, or loosen eligibility/variant-group restrictions.`
    );
  }
  return selected;
}

function computePositionsByDifficulty(): Record<EventDifficulty, [number, number][]> {
  const positions: Record<EventDifficulty, [number, number][]> = { e: [], m: [], h: [] };
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
      if (event.guaranteed) locations.push(positionsByDifficulty[difficulty][index]);
    });
  });
  return locations;
}

function positionGuaranteedItems(tiers: Tiers): Tiers {
  let current = tiers;
  for (let attempt = 1; attempt <= MAX_POSITIONING_ATTEMPTS; attempt++) {
    if (!hasLineCollision(guaranteedLocations(current))) return current;
    current = {
      e: shuffleObjectArray(current.e),
      m: shuffleObjectArray(current.m),
      h: shuffleObjectArray(current.h),
    };
  }
  throw new Error(
    `Could not lay out guaranteed items without sharing a row/column/diagonal after ${MAX_POSITIONING_ATTEMPTS} attempts -- likely too many guaranteed items for the grid layout to ever satisfy.`
  );
}

function resolveEvent(
  event: DisneyEvent,
  gridOwner: Person,
  songFromPerson: Record<Person, string>,
  shirtNumbers: Record<Person, string>
): { summary: string; description: string } {
  const needsInputs = typeof event.summary === "function" || typeof event.description === "function";
  if (!needsInputs) {
    return { summary: event.summary as string, description: event.description as string };
  }
  const inputs: DisneySeedingInputs = {
    gridOwner,
    drinker: Math.random() < 0.5 ? "Ben" : "Jason",
    randomPerson: people[Math.floor(Math.random() * people.length)],
    song: songFromPerson[gridOwner],
    shirtNumber: shirtNumbers[gridOwner],
  };
  return {
    summary: typeof event.summary === "function" ? event.summary(inputs) : event.summary,
    description: typeof event.description === "function" ? event.description(inputs) : event.description,
  };
}

function buildGridForPerson(
  pool: Tiers,
  gridOwner: Person,
  songFromPerson: Record<Person, string>,
  shirtNumbers: Record<Person, string>
): { grid: Grid; sourceIndices: number[] } {
  const tiers: Tiers = {
    e: selectTierItems(pool.e, gridOwner, "e"),
    m: selectTierItems(pool.m, gridOwner, "m"),
    h: selectTierItems(pool.h, gridOwner, "h"),
  };
  const positioned = positionGuaranteedItems(tiers);
  const index = { e: 0, m: 0, h: 0 };
  const sourceIndices: number[] = [];

  const grid: Grid = difficultyKey.map((row) =>
    row.map((difficulty): GridCell => {
      if (difficulty === "f") {
        return { difficulty: "f", summary: "free", description: "free", id: crypto.randomUUID() };
      }
      const tierDifficulty = difficulty as EventDifficulty;
      const { event, sourceIndex } = positioned[tierDifficulty][index[tierDifficulty]++];
      sourceIndices.push(sourceIndex);
      const resolved = resolveEvent(event, gridOwner, songFromPerson, shirtNumbers);
      return { difficulty: event.difficulty, ...resolved, id: crypto.randomUUID() };
    })
  );

  return { grid, sourceIndices };
}

function checkBalance(counts: number[]): { ok: boolean; reason?: string } {
  const appearingAtLeastTwice = counts.filter((c) => c >= 2).length;
  const ratio = counts.length ? appearingAtLeastTwice / counts.length : 1;
  if (ratio < BALANCE_MIN_APPEARANCE_RATIO) {
    return {
      ok: false,
      reason: `only ${(ratio * 100).toFixed(0)}% of events appeared at least twice across all grids (need ${
        BALANCE_MIN_APPEARANCE_RATIO * 100
      }%)`,
    };
  }
  return { ok: true };
}

export function getDisneyGrids({
  events,
  people: tripPeople,
  songFromPerson,
  shirtNumbers,
}: {
  events: DisneyEvent[];
  people: Person[];
  songFromPerson: Record<Person, string>;
  shirtNumbers: Record<Person, string>;
}): Grid[] {
  const indexed: IndexedEvent[] = events.map((event, sourceIndex) => ({ event, sourceIndex }));
  const pool: Tiers = {
    e: indexed.filter((e) => e.event.difficulty === "e"),
    m: indexed.filter((e) => e.event.difficulty === "m"),
    h: indexed.filter((e) => e.event.difficulty === "h"),
  };

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const built = tripPeople.map((person) => buildGridForPerson(pool, person, songFromPerson, shirtNumbers));
    const counts = new Array(events.length).fill(0) as number[];
    for (const { sourceIndices } of built) {
      for (const idx of sourceIndices) counts[idx]++;
    }
    const balance = checkBalance(counts);
    console.log(
      `[disney-2026] generation attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${
        balance.ok ? "passed" : "failed"
      }${balance.reason ? ` (${balance.reason})` : ""}`
    );
    if (balance.ok) return built.map((b) => b.grid);
  }
  throw new Error(`Failed to produce a balanced set of grids after ${MAX_GENERATION_ATTEMPTS} attempts.`);
}
