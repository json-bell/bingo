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
      <ul className="flex flex-wrap justify-center text-black">
        {grids.map((grid, index) => (
          <li
            key={people[index]}
            id={people[index]}
            className="bg-[rgb(199,220,252)] p-8 m-8 list-none rounded-tr-[2rem] rounded-bl-[2rem] shadow-[0_0_10px_10px_#adfceb] text-center"
          >
            <h2 className="text-2xl font-bold">
              {people[index]}&apos;s grid (number {index + 1})
            </h2>
            <Grid grid={grid} />
          </li>
        ))}
      </ul>
    </>
  );
}
