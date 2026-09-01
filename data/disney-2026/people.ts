// disney-2026's people list -- confirm this is final before wiring it into
// the real make-grid pipeline (see temp-prompt.md item #4). `as const` so
// `Person` is a literal union, giving compile-time typo protection anywhere
// a specific person is referenced (eligiblePeople, SeedingInputs, etc.).
export const people = ["Ben", "Ciara", "James", "Jason", "Maria", "Sarah", "Thomas"] as const;

export type Person = (typeof people)[number];
