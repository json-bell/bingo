import { Link } from "react-router-dom";
import { listSlugs } from "../lib/trips";

export function Home() {
  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Trips</h1>
      <ul className="flex flex-col gap-3">
        {listSlugs().map((slug) => (
          <li key={slug}>
            <Link
              to={`/${slug}`}
              className="flex items-center justify-center min-h-12 rounded-xl bg-surface text-ink px-4 py-3 text-lg font-semibold hover:bg-brand hover:text-brand-foreground transition-colors"
            >
              {slug}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
