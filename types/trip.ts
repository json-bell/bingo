export type Difficulty = "e" | "m" | "h" | "f";

export interface BingoItem {
  difficulty: Difficulty;
  summary: string;
  description: string;
}

// A BingoItem once it's been placed into a specific person's grid — as opposed
// to a template event still sitting in the shuffle pool (data/<slug>/data.ts).
// The same source event can end up placed into several different people's
// grids, each as its own cell, so the id is assigned at placement time
// (data/getGrids.ts), never on the source BingoItem itself.
export interface GridCell extends BingoItem {
  id: string;
}

export type Grid = GridCell[][];

export interface TripConfig {
  currentVersion: number;
  title: string;
}

export type TripsConfig = Record<string, TripConfig>;

export interface LoadedTrip {
  grids: Grid[];
  people: string[];
  title: string;
  version: number;
}
