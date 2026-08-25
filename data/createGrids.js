import fs from "fs/promises";
import { dataPromise } from "./getData.js";
import { getGrids } from "./getGrids.js";
console.log(dataPromise);

dataPromise.then(() => {
  fs.readdir("./grids")
    .then((files) => files.length)
    .then((gridsVersion) => {
      fs.writeFile(
        `./grids/grid-v-new.js`,
        "export const grids =" + JSON.stringify(getGrids(), null, 2)
      );
    });
});
