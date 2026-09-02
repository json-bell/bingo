// disney-2026's people list -- already wired into the real make-grid
// pipeline (data/disney-2026/generateGrids.ts). `as const` so `Person` is a
// literal union, giving compile-time typo protection anywhere a specific
// person is referenced (eligiblePeople, SeedingInputs, etc.).
export const people = ["Ben", "Ciara", "James", "Jason", "Maria", "Sarah", "Thomas"] as const;

export type Person = (typeof people)[number];
