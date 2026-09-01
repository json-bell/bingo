import type { Person } from "./people";

// Every field here is an already-resolved flat value, computed once per
// cell before either summary or description is called -- never a live
// sampler or a raw key a resolver looks up itself (docs/grid-content-pipeline.md
// §3). The same object is passed to both fields of one cell, so e.g.
// `drinker` can never disagree between a cell's title and its description.
export interface DisneySeedingInputs {
  gridOwner: Person; // whose grid this cell belongs to
  drinker: Person; // Uniform(Ben, Jason) for now -- see docs/grid-content-pipeline.md §3
  randomPerson: Person; // Uniform(all 7) -- not yet used by any event below, kept for flexibility
  song: string; // personToSong[gridOwner], from the standalone song-assignment script (§4)
  shirtNumber: string; // shirtNumbers[gridOwner], hand-authored
}
