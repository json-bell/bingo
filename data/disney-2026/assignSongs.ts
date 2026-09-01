function shuffle<T>(arr: readonly T[]): T[] {
  return [...arr]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

// Cyclic assignment: random-permute both lists, then assign position i to
// songs[i % songs.length] -- with one more person than songs, this is
// surjective (every song used at least once) and gives exactly one doubled
// song, with which song/which pair is doubled both uniform (docs/grid-content-pipeline.md
// §4). Pulled out of scripts/generatePersonToSong.ts so the algorithm itself
// is unit-testable without touching the filesystem.
export function assignSongs(people: readonly string[], songs: readonly string[]): Record<string, string> {
  if (people.length !== songs.length + 1) {
    throw new Error(
      `Cyclic assignment needs exactly one more person than songs -- got ${people.length} people, ${songs.length} songs.`
    );
  }

  const shuffledPeople = shuffle(people);
  const shuffledSongs = shuffle(songs);

  const result: Record<string, string> = {};
  shuffledPeople.forEach((person, i) => {
    result[person] = shuffledSongs[i % shuffledSongs.length];
  });
  return result;
}
