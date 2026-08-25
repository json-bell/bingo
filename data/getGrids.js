function shuffleObjectArray(arr) {
  return arr
    .map(({ ...obj }) => ({ ...obj, place: Math.random() }))
    .sort((a, b) => a.place - b.place)
    .map(({ place, ...obj }) => obj);
}

function getShuffledCharArray(characters) {
  return [
    "TOO MANY NEW BINGO PLS",
    ...characters
      .map((name) => ({ name, place: Math.random() }))
      .sort((a, b) => a.place - b.place)
      .map(({ name }) => name),
  ];
}

const difficultyKey = [
  ["h", "e", "m", "e", "h"],
  ["e", "m", "h", "m", "e"],
  ["m", "h", "f", "h", "m"],
  ["e", "m", "h", "m", "e"],
  ["h", "e", "m", "e", "h"],
];

function addCharName(item, name) {
  item.description = item.summary + " " + name;
}

function makeGrid(Events, characters) {
  const shuffledChars = getShuffledCharArray(characters);
  const [easyOrder, medOrder, hardOrder] = Events.map(shuffleObjectArray);
  const edgeIndex = Math.floor(4 * Math.random());
  const medLength = medOrder.length;
  const jerseyIndex = medLength - 1 - [0, 3, 4, 7][edgeIndex];
  console.log(jerseyIndex);
  medOrder[jerseyIndex] = {
    type: "challenge",
    difficulty: "m",
    summary: "jersey number",
    description:
      "You get a picture with something that has your jersey number on",
  };
  console.log("med challenge order->>", medOrder);
  const orderedEvents = {
    e: easyOrder,
    m: medOrder,
    h: hardOrder,
    f: [
      { type: "free", difficulty: "f", summary: "free", description: "free" },
    ],
  };
  return difficultyKey.map((row) =>
    row.map((difficulty) => {
      const newItem = orderedEvents[difficulty].pop();
      if (["hug", "fistbump"].includes(newItem.summary)) {
        addCharName(newItem, shuffledChars.pop());
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
      return newItem;
    })
  );
}

export function getGrids({ data, characters, people, number = people.length }) {
  console.log("running getGrids");
  const allEvents = data.rows;
  const easyEvents = allEvents.filter(({ difficulty }) => difficulty === "e");
  const medEvents = allEvents.filter(({ difficulty }) => difficulty === "m");
  const hardEvents = allEvents.filter(({ difficulty }) => difficulty === "h");
  const Events = [easyEvents, medEvents, hardEvents];

  return Array(number)
    .fill(0)
    .map(() => {
      const output = makeGrid(Events, characters);
      return output;
    });
}
