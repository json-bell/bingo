import { db } from "../db/client";
import { checked } from "../db/schema";
import type { Grid } from "../types/trip";

export async function seedGrid(
  slug: string,
  version: number,
  grids: Grid[],
  people: string[]
): Promise<number> {
  // grids[i] <-> people[i] is positional and unenforced in the static-file
  // world (docs/plan.md flags this as pre-existing). Seeding writes that
  // pairing into the database, so assert it here rather than persisting a
  // silent mismatch.
  if (grids.length !== people.length) {
    throw new Error(`Grid/people mismatch: ${grids.length} grids, ${people.length} people`);
  }

  const rows = grids.flatMap((grid, personIndex) =>
    grid.flat().map((cell) => {
      // grids/europapark-2024/1.json predates cell ids entirely (it's the
      // pre-backfill version -- see docs/plan.md). Fail loudly rather than
      // inserting a null primary key.
      if (!cell.id) {
        throw new Error(`Cell without an id in ${slug} v${version} -- grid predates cell ids?`);
      }
      return {
        cellId: cell.id,
        checked: false,
        tripSlug: slug,
        gridVersion: version,
        person: people[personIndex],
      };
    })
  );

  // Idempotent: safe to re-run after a partial failure. Cell ids are
  // freshly minted per make-grid run so conflicts should never actually
  // occur -- this is a retry affordance, not a merge strategy.
  await db.insert(checked).values(rows).onConflictDoNothing();
  return rows.length;
}

// Host only, never credentials -- printed after seeding so it's impossible
// to seed dev and then wonder why production is empty. See
// docs/backend-architecture.md §5: which database gets seeded is whatever
// DATABASE_URL is set to when this runs, a human decision at generation time.
export function dbLabel(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(no DATABASE_URL set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
