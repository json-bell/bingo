import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { Navigation } from "../components/Navigation";
import { Grid } from "../components/Grid";
import { loadTrip } from "../lib/trips";
import type { LoadedTrip } from "../../types/trip";

export function TripPage() {
  const { slug } = useParams<{ slug: string }>();
  const [trip, setTrip] = useState<LoadedTrip | null | undefined>(undefined); // undefined = loading, null = not found

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setTrip(undefined);
    loadTrip(slug).then((result) => {
      if (!cancelled) setTrip(result);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) return null;
  if (trip === undefined) return <p>Loading…</p>;
  if (trip === null) return <p>No trip found for &quot;{slug}&quot;.</p>;

  const { grids, people } = trip;
  return (
    <>
      <Header />
      <br />
      <Navigation people={people} />
      <ul className="flex flex-wrap justify-center text-ink">
        {grids.map((grid, index) => (
          <li
            key={people[index]}
            id={people[index]}
            className="bg-surface p-8 m-8 list-none rounded-tr-[2rem] rounded-bl-[2rem] shadow-[0_0_10px_10px_var(--color-accent)] text-center"
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
