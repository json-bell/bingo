import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { Navigation } from "../components/Navigation";
import { Grid } from "../components/Grid";
import { loadTrip } from "../lib/trips";

export function TripPage() {
  const { slug } = useParams();
  const [trip, setTrip] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    setTrip(undefined);
    loadTrip(slug).then((result) => {
      if (!cancelled) setTrip(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (trip === undefined) return <p>Loading…</p>;
  if (trip === null) return <p>No trip found for &quot;{slug}&quot;.</p>;

  const { grids, people } = trip;
  return (
    <>
      <Header />
      <br />
      <Navigation people={people} />
      <ul className="grids-container">
        {grids.map((grid, index) => (
          <li
            key={people[index]}
            id={people[index]}
            className="personal-container"
          >
            <h2>
              {people[index]}&apos;s grid (number {index + 1})
            </h2>
            <Grid grid={grid} />
          </li>
        ))}
      </ul>
    </>
  );
}
