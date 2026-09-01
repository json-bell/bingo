// Placeholder song list -- real Guardians of the Galaxy playlist song
// choices aren't picked yet. Exactly 6 entries because the song-assignment
// script (scripts/generatePersonToSong.ts) needs precisely one fewer song
// than there are people (7 people, 6 songs) for its cyclic assignment
// (docs/grid-content-pipeline.md §4). Replace with real titles before
// disney-2026 goes live, and rerun scripts/generatePersonToSong.ts --force
// once they're final.
export const songs = [
  "September",
  "Disco Inferno",
  "Everybody Wants to Rule the World",
  "One Way or Another",
  "I Ran (So Far Away)",
  "Conga"
] as const;
