import { Link } from "react-router-dom";
import { listSlugs } from "../lib/trips";

export function Home() {
  return (
    <>
      <h1>Trips</h1>
      <ul>
        {listSlugs().map((slug) => (
          <li key={slug}>
            <Link to={`/${slug}`}>{slug}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
