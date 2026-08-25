import fs from "fs/promises";

/*
Read google sheet
write to data.js
*/

export async function generateDataFile(slug) {
  const rawText = await fs.readFile(`data/${slug}/bingoes.csv`, "utf-8");
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
  const data = { rows };

  await fs.writeFile(
    `data/${slug}/data.js`,
    "export const data = " + JSON.stringify(data, null, 2) + "\n"
  );
}
