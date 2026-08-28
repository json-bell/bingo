import { describe, expect, it } from "vitest";
import { GET } from "./db";

describe("GET /api/health/db", () => {
  it("returns 200 with a real row count against the test database", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; rows: number; latencyMs: number };
    expect(body).toMatchObject({ status: "ok", rows: 0 });
    expect(typeof body.latencyMs).toBe("number");
  });
});
