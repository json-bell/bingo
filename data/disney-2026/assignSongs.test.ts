import { describe, it, expect } from "vitest";
import { assignSongs } from "./assignSongs";

const people = ["Ben", "Ciara", "James", "Jason", "Maria", "Sarah", "Thomas"];
const songs = ["Song A", "Song B", "Song C", "Song D", "Song E", "Song F"];

describe("assignSongs", () => {
  it("throws unless there's 7 ppl 6 songs", () => {
    expect(() => assignSongs(people, songs.slice(0, 5))).toThrow(
      /Wrong number/i
    );
    expect(() => assignSongs(people.slice(0, 6), songs)).toThrow(
      /Wrong number/i
    );
  });

  it("assigns every person a real song from the list", () => {
    const result = assignSongs(people, songs);

    expect(Object.keys(result).sort()).toEqual([...people].sort());
    for (const person of people) {
      expect(songs).toContain(result[person]);
    }
  });

  it("is surjective -- every song is used at least once", () => {
    const result = assignSongs(people, songs);
    const used = new Set(Object.values(result));

    expect(used.size).toBe(songs.length);
  });

  it("doubles exactly one song, by pigeonhole (7 people, 6 songs)", () => {
    const result = assignSongs(people, songs);
    const counts = new Map<string, number>();
    for (const song of Object.values(result)) {
      counts.set(song, (counts.get(song) ?? 0) + 1);
    }

    const tally = [...counts.values()].sort();
    expect(tally).toEqual([1, 1, 1, 1, 1, 2]);
  });
});
