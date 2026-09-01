import type { BingoItem, Difficulty, Grid, GridCell } from "../types/trip";

function shuffleObjectArray<T extends object>(arr: T[]): T[] {
  return arr
    .map((obj) => ({ ...obj, place: Math.random() }))
    .sort((a, b) => a.place - b.place)
    .map(({ place, ...rest }) => rest as T);
}

function getShuffledCharArray(characters: string[]): string[] {
  return [
    "TOO MANY NEW BINGO PLS",
    ...characters
      .map((name) => ({ name, place: Math.random() }))
      .sort((a, b) => a.place - b.place)
      .map(({ name }) => name),
  ];
}

const difficultyKey: Difficulty[][] = [
  ["h", "e", "m", "e", "h"],
  ["e", "m", "h", "m", "e"],
  ["m", "h", "f", "h", "m"],
  ["e", "m", "h", "m", "e"],
  ["h", "e", "m", "e", "h"],
];

function addCharName(item: BingoItem, name: string): void {
  item.description = item.summary + " " + name;
}

function makeGrid(
  events: [BingoItem[], BingoItem[], BingoItem[]],
  characters: string[]
): Grid {
  const shuffledChars = getShuffledCharArray(characters);
  const [easyOrder, medOrder, hardOrder] = events.map(shuffleObjectArray);
  const edgeIndex = Math.floor(4 * Math.random());
  const medLength = medOrder.length;
  const jerseyIndex = medLength - 1 - [0, 3, 4, 7][edgeIndex];
  medOrder[jerseyIndex] = {
    difficulty: "m",
    summary: "jersey number",
    description:
      "You get a picture with something that has your jersey number on",
  };
  const orderedEvents: Record<Difficulty, BingoItem[]> = {
    e: easyOrder,
    m: medOrder,
    h: hardOrder,
    f: [
      { difficulty: "f", summary: "free", description: "free" },
    ],
  };
  return difficultyKey.map((row) =>
    row.map((difficulty) => {
      const newItem = orderedEvents[difficulty].pop();
      if (!newItem) {
        throw new Error(
          `Ran out of "${difficulty}" difficulty events while building a grid — need more rows of that difficulty in the CSV`
        );
      }
      if (["hug", "fistbump"].includes(newItem.summary)) {
        const name = shuffledChars.pop();
        if (name) addCharName(newItem, name);
      }
      if (newItem.summary === "other") {
        const index = Math.floor(Math.random() * 2);
        const action = ["Hug", "Fistbump"][index];
        newItem.summary = action.toLowerCase() + " other";
        newItem.description = action + " another character (might not exist)";
      }
      if (newItem.summary.includes("jersey pic")) {
        const index = Math.floor(Math.random() * 2);
        const goal = [
          {
            summary: "jersey pic",
            description: "We get a jersey picture",
          },
          {
            summary: "2 jersey pic",
            description: "We get 2 jersey pics (blue and white)",
          },
        ][index];
        newItem.description = goal.description;
        newItem.summary = goal.summary;
      }
      const cell: GridCell = { ...newItem, id: crypto.randomUUID() };
      return cell;
    })
  );
}

export function getGrids({
  data,
  characters,
  people,
  number = people.length,
}: {
  data: { rows: BingoItem[] };
  characters: string[];
  people: string[];
  number?: number;
}): Grid[] {
  const allEvents = data.rows;
  const easyEvents = allEvents.filter(({ difficulty }) => difficulty === "e");
  const medEvents = allEvents.filter(({ difficulty }) => difficulty === "m");
  const hardEvents = allEvents.filter(({ difficulty }) => difficulty === "h");
  const events: [BingoItem[], BingoItem[], BingoItem[]] = [
    easyEvents,
    medEvents,
    hardEvents,
  ];

  return Array(number)
    .fill(0)
    .map(() => makeGrid(events, characters));
}
