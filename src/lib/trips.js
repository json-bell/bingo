import tripsConfig from "../../config/trips.json";

const gridLoaders = import.meta.glob("../../grids/*/*.json");
const peopleLoaders = import.meta.glob("../../data/*/people.js");

export function listSlugs() {
  return Object.keys(tripsConfig);
}

export async function loadTrip(slug) {
  const tripConfig = tripsConfig[slug];
  if (!tripConfig) return null;
  const loadGrid = gridLoaders[`../../grids/${slug}/${tripConfig.currentGrid}.json`];
  const loadPeople = peopleLoaders[`../../data/${slug}/people.js`];
  if (!loadGrid || !loadPeople) return null;
  const [gridModule, peopleModule] = await Promise.all([loadGrid(), loadPeople()]);
  return { grids: gridModule.default, people: peopleModule.people };
}
