import type { Grid, LoadedTrip, TripsConfig } from "../../types/trip";
import tripsConfigJson from "../../config/trips.json";

const tripsConfig = tripsConfigJson as TripsConfig;

const gridLoaders = import.meta.glob<{ default: Grid[] }>(
  "../../grids/*/*.json"
);
const peopleLoaders = import.meta.glob<{ people: string[] }>(
  "../../data/*/people.ts"
);

export function listSlugs(): string[] {
  return Object.keys(tripsConfig);
}

export async function loadTrip(slug: string): Promise<LoadedTrip | null> {
  const tripConfig = tripsConfig[slug];
  if (!tripConfig) return null;
  const loadGrid =
    gridLoaders[`../../grids/${slug}/${tripConfig.currentVersion}.json`];
  const loadPeople = peopleLoaders[`../../data/${slug}/people.ts`];
  if (!loadGrid || !loadPeople) return null;
  const [gridModule, peopleModule] = await Promise.all([
    loadGrid(),
    loadPeople(),
  ]);
  return { grids: gridModule.default, people: peopleModule.people, title: tripConfig.title };
}
