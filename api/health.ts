import { json } from "./lib/responses.js";

// No database access at all — this answers "is the function deployment
// alive and routing correctly", isolated from whether Neon is reachable.
// See docs/backend-architecture.md §4. Never returns 503: if this route
// is unreachable, the problem is Vercel routing or the build, not the DB.
export function GET(): Response {
  return json({ status: "ok", service: "bingo-api", time: new Date().toISOString() });
}
