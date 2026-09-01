import type { Person } from "./people";

// Placeholder shirt numbers -- sequential 1-7 in people.ts's list order,
// not real numbers yet (Ciara's real one is 83, per draft-ideas.md). Hand-
// authored directly, unlike personToSong.ts -- see docs/grid-content-pipeline.md §4.
export const shirtNumbers: Record<Person, string> = {
  Ben: "11",
  Ciara: "83",
  James: "55",
  Jason: "54",
  Maria: "38",
  Sarah: "30",
  Thomas: "99"
};
