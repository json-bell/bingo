import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        navigateFallback: "/index.html",
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
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: { chunkFileNames },
    },
  },
});
