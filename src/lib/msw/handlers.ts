import { http, HttpResponse } from "msw";

// Generic, always-succeeds defaults so most tests don't need their own
// handlers at all -- individual tests override via server.use(...) for the
// specific status codes/bodies they actually care about (see
// docs/backend-architecture.md §3's status contract).
export const defaultHandlers = [
  http.get("/api/trips/:slug/checked", ({ params, request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      slug: params.slug,
      version: Number(url.searchParams.get("version")) || 1,
      cells: {},
      generatedAt: new Date().toISOString(),
    });
  }),
  http.patch("/api/checked", async ({ request }) => {
    const body = (await request.json()) as { id: string; checked: boolean };
    return HttpResponse.json({
      id: body.id,
      checked: body.checked,
      updatedAt: new Date().toISOString(),
    });
  }),
  http.get("/api/health/db", () => {
    return HttpResponse.json({ status: "ok", rows: 0, latencyMs: 1 });
  }),
];
