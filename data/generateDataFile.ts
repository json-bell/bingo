import fs from "fs/promises";
import type { Difficulty, BingoItem } from "../types/trip";

const EVENT_DIFFICULTIES: readonly string[] = ["e", "m", "h"];

function isEventDifficulty(value: string): value is Difficulty {
  return EVENT_DIFFICULTIES.includes(value);
}

/*
Read google sheet
write to data.ts
*/

export async function generateDataFile(slug: string): Promise<void> {
  const rawText = await fs.readFile(`data/${slug}/bingoes.csv`, "utf-8");
  const splitString = rawText.split("SPLITHERE")[0].split(",,,\r\n");
  const keysAndRows = splitString.filter((string) => string.endsWith("\r\n"));
  const rows: BingoItem[] = keysAndRows
    .slice(1)
    .join("")
    .split("\r\n")
    .map((row) => row.split(","))
    .filter((row) => isEventDifficulty(row[1]))
    .map(([type, difficulty, summary, description]) => ({
      type,
      difficulty: difficulty as Difficulty,
      summary,
      description,
    }));
  const data = { rows };

  await fs.writeFile(
    `data/${slug}/data.ts`,
    `import type { BingoItem } from "../../types/trip";\n\n` +
      `export const data: { rows: BingoItem[] } = ${JSON.stringify(data, null, 2)};\n`
  );
}
