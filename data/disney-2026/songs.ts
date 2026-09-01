// Placeholder song list -- real Guardians of the Galaxy playlist song
// choices aren't picked yet. Exactly 6 entries because the song-assignment
// script (scripts/generatePersonToSong.ts) needs precisely one fewer song
// than there are people (7 people, 6 songs) for its cyclic assignment
// (docs/grid-content-pipeline.md §4). Replace with real titles before
// disney-2026 goes live, and rerun scripts/generatePersonToSong.ts --force
// once they're final.
export const songs = [
  "Song A", // TODO: real title
  "Song B", // TODO: real title
  "Song C", // TODO: real title
  "Song D", // TODO: real title
  "Song E", // TODO: real title
  "Song F", // TODO: real title
] as const;
