// The shared HTTP status contract for every route — see
// docs/backend-architecture.md §3. Defined once here and applied
// identically everywhere so a client (eventually the offline queue) can
// pattern-match on status codes without per-route special cases.

export function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function apiError(status: number, code: string, message: string, extra?: object): Response {
  return json({ error: { code, message }, ...extra }, status);
}

export function methodNotAllowed(allow: string): Response {
  return json({ error: { code: "METHOD_NOT_ALLOWED", message: `Allowed: ${allow}` } }, 405, {
    Allow: allow,
  });
}
