import fs from "fs/promises";

const characters = [
  `“Ed Euromaus” aka Fake Mickey`,
  `“Edda Euromausi” aka Fake Minnie`,
  `“Louis” (ngl not sure who this is look here mb)`,
  `“Böckli” (see above comment)`,
  `“Europhant” (imma guess that's the elephant but who knows tbh) aka Fake Dumbo`,
];

/*
Read google sheet
write to data.js
*/

export const dataPromise = fs
  .readFile(`data/bingoes.csv`, "utf-8")
  .then((rawText) => {
    const splitString = rawText.split("SPLITHERE")[0].split(",,,\r\n");
    const keysAndRows = splitString.filter((string) => string.endsWith("\r\n"));
    const rows = keysAndRows
      .slice(1)
      .join("")
      .split("\r\n")
      .map((row) => row.split(","))
      .filter((row) => ["e", "m", "h"].includes(row[1]))
      .map(([type, difficulty, summary, description]) => ({
        type,
        difficulty,
        summary,
        description,
      }));
    return { rows };
  })
  .then((data) =>
    fs.writeFile(
      "data/data.js",
      "export const characters = " +
        JSON.stringify(characters, null, 2) +
        "\n" +
        "export const data = " +
        JSON.stringify(data, null, 2)
    )
  );
