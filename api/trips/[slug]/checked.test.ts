import { describe, expect, it } from "vitest";
import { db } from "../../../db/client.js";
import { checked } from "../../../db/schema.js";
import { GET } from "./checked.js";

function seedRow(overrides: Partial<typeof checked.$inferInsert> = {}) {
  return db.insert(checked).values({
    cellId: crypto.randomUUID(),
    checked: false,
    tripSlug: "test-trip",
    gridVersion: 1,
    person: "Alex",
    ...overrides,
  });
}

describe("GET /api/trips/[slug]/checked", () => {
  it("returns the checked map for a trip's cells, including updatedAt", async () => {
    await seedRow({ checked: true });
    await seedRow({ checked: false });

    const response = await GET(
      new Request("http://localhost/api/trips/test-trip/checked?version=1")
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      slug: string;
      version: number;
      cells: Record<string, { checked: boolean; updatedAt: string }>;
    };
    expect(body.slug).toBe("test-trip");
    expect(body.version).toBe(1);
    expect(Object.keys(body.cells)).toHaveLength(2);
    for (const cell of Object.values(body.cells)) {
      expect(typeof cell.checked).toBe("boolean");
      expect(new Date(cell.updatedAt).toString()).not.toBe("Invalid Date");
    }
  });

  it("returns 200 with an empty map for an unknown/unseeded slug", async () => {
    const response = await GET(
      new Request("http://localhost/api/trips/nonexistent-trip/checked?version=1")
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { cells: Record<string, unknown> };
    expect(body.cells).toEqual({});
  });

  it("returns 400 when version is missing", async () => {
    const response = await GET(new Request("http://localhost/api/trips/test-trip/checked"));
    expect(response.status).toBe(400);
  });

  it("returns 400 when version is not a positive integer", async () => {
    const response = await GET(
      new Request("http://localhost/api/trips/test-trip/checked?version=abc")
    );
    expect(response.status).toBe(400);
  });

  it("excludes rows from a different grid_version of the same slug", async () => {
    await seedRow({ gridVersion: 1 });
    await seedRow({ gridVersion: 2 });

    const response = await GET(
      new Request("http://localhost/api/trips/test-trip/checked?version=1")
    );
    const body = (await response.json()) as { cells: Record<string, unknown> };
    expect(Object.keys(body.cells)).toHaveLength(1);
  });
});
