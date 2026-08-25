export type Difficulty = "e" | "m" | "h" | "f";

export interface BingoItem {
  type: string;
  difficulty: Difficulty;
  summary: string;
  description: string;
}

export type Grid = BingoItem[][];

export interface TripConfig {
  currentGrid: number;
}

export type TripsConfig = Record<string, TripConfig>;

export interface LoadedTrip {
  grids: Grid[];
  people: string[];
}
