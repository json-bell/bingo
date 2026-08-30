import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Baked in at build time (not read at runtime -- there's no server to ask),
// so the deployed app can show what commit it's actually running, mostly to
// tell whether a Vercel deploy has landed yet. VERCEL_GIT_COMMIT_SHA is one
// of Vercel's automatic build-time System Environment Variables -- no
// project config needed, just present whenever Vercel is the one building.
// Falls back to the local git HEAD (short SHA) for `npm run build` outside
// Vercel, and to a literal "dev" if that also fails (e.g. no .git present).
function resolveCommitSha(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// Trip data (grids/<slug>/<n>.json, data/<slug>/people.ts) is lazy-loaded via
// import.meta.glob in src/lib/trips.ts and bundled as ordinary JS chunks —
// there's no separate ".json" network request to tell it apart from app-shell
// code by URL. Routing these chunks into their own trip-data/ output
// directory gives the service worker (see VitePWA below) a URL pattern to
// runtime-cache them separately from the rest of the app: only the slug(s) a
// visitor actually opens get cached, not every trip in the repo.
function chunkFileNames(chunkInfo: { moduleIds: string[] }) {
  const isTripData = chunkInfo.moduleIds.some(
    (id) => id.includes("/grids/") || id.endsWith("/people.ts")
  );
  return isTripData ? "trip-data/[name]-[hash].js" : "assets/[name]-[hash].js";
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        navigateFallback: "/index.html",
        // Without this, the service worker's own NavigationRoute intercepts
        // *any* navigation request (typing a URL, following a link) within
        // its scope and serves the cached app shell instead — client-side,
        // before the request ever reaches the network, so vercel.json's
        // rewrite fix (see docs/backend-architecture.md §8) can't help here
        // at all. Hit this for real: navigating straight to /api/health in
        // a browser rendered an empty page (the app shell, with React
        // Router matching no route for it) instead of reaching the function.
        navigateFallbackDenylist: [/^\/api\//],
        // Trip data is handled by the runtimeCaching rule below instead of
        // being precached upfront — see the chunkFileNames comment above.
        globIgnores: ["**/trip-data/**"],
        runtimeCaching: [
          {
            // Content-hashed per grid version — a promoted grid is a new
            // numbered file (grids/<slug>/<n>.json), never an edit of an
            // existing one — so CacheFirst is correct here, not just
            // convenient: a given URL's content genuinely cannot change.
            urlPattern: /\/trip-data\/.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "trip-data",
              expiration: { maxEntries: 20 },
            },
          },
          {
            // Checked state is mutable, unlike trip-data — so NetworkFirst,
            // not CacheFirst: try the network for freshness, fall back to
            // the last good response when it fails. This is what makes
            // "the state as of the last time the app loaded online"
            // available offline. See docs/backend-architecture.md §9.
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/checked"),
            method: "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "checked-state",
              // Flaky venue wifi hangs rather than failing fast; without
              // this the app waits on a dead socket instead of rendering
              // cached state.
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20 },
              // Never cache an error response as if it were state.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: { chunkFileNames },
    },
  },
  test: {
    // Backend tests need a "node" environment and their own setupFiles
    // (migrate-once, truncate-per-test against bingo_test, per
    // docs/backend-architecture.md §7) -- neither of which the existing
    // jsdom project should carry. Vitest 4.1 uses test.projects for this;
    // environmentMatchGlobs (≤2) and vitest.workspace.ts (≤3) are both
    // removed in this version, so don't reach for either.
    projects: [
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          // seedGrid.test.ts needs the api project's DB setup (real
          // Postgres, migrate + truncate) -- excluded here so it doesn't
          // also run under jsdom with no database connection at all.
          include: ["src/**/*.test.{ts,tsx}", "data/**/*.test.ts"],
          exclude: ["data/seedGrid.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          environment: "node",
          setupFiles: ["./api/test/setup.ts"],
          include: ["api/**/*.test.ts", "db/**/*.test.ts", "data/seedGrid.test.ts"],
          // All api tests share one real bigo_test Postgres database (no
          // per-file isolation), and each test's beforeEach TRUNCATEs the
          // whole checked table -- Vitest's default file parallelism let
          // two files' truncates interleave with each other's inserts,
          // causing real, observed flaky row-count failures. Small hobby
          // project, not worth per-file DB isolation to get parallelism
          // back: just serialize.
          fileParallelism: false,
        },
      },
    ],
  },
});
