import { Grid } from "./components/Grid";
import { Header } from "./components/Header";
import { grids } from "../grids/grid-v-final";
import { Navigation } from "./components/Navigation";
import { people } from "../data/people";

const bingoGrids = grids;
const App = () => {
  return (
    <>
      <Header />
      <br />
      <Navigation />
      <ul className="grids-container">
        {bingoGrids.map((grid, index) => (
          <li
            key={people[index]}
            id={people[index]}
            className="personal-container"
          >
            <h2>
              {people[index]}'s grid (number {index + 1})
            </h2>
            <Grid grid={grid} />
          </li>
        ))}
      </ul>
    </>
  );
};

export default App;
