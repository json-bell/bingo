import { describe, it, expect, beforeEach } from "vitest";
import { getChecked, setChecked } from "./checked";

// Assertions here are phrased against what getChecked/setChecked promise to
// return, not localStorage-specific mechanics — see docs/test-plan.md's
// "Long-term" section for why that matters once phase 2 swaps the
// implementation behind this same seam for a REST API.
describe("checked", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty map when nothing has been stored yet", async () => {
    expect(await getChecked("europapark-2024", "Ben")).toEqual({});
  });

  it("persists a value and returns it on the next read", async () => {
    await setChecked("europapark-2024", "Ben", "cell-1", true);
    expect(await getChecked("europapark-2024", "Ben")).toEqual({ "cell-1": true });
  });

  it("accumulates sequential writes rather than clobbering earlier ones", async () => {
    await setChecked("europapark-2024", "Ben", "cell-1", true);
    await setChecked("europapark-2024", "Ben", "cell-2", true);
    const result = await setChecked("europapark-2024", "Ben", "cell-1", false);

    expect(result).toEqual({ "cell-1": false, "cell-2": true });
    expect(await getChecked("europapark-2024", "Ben")).toEqual({ "cell-1": false, "cell-2": true });
  });

  it("keeps different (tripSlug, person) pairs fully isolated", async () => {
    await setChecked("europapark-2024", "Ben", "cell-1", true);
    await setChecked("europapark-2024", "Cameron", "cell-1", false);
    await setChecked("disney-2026", "Ben", "cell-1", false);

    expect(await getChecked("europapark-2024", "Ben")).toEqual({ "cell-1": true });
    expect(await getChecked("europapark-2024", "Cameron")).toEqual({ "cell-1": false });
    expect(await getChecked("disney-2026", "Ben")).toEqual({ "cell-1": false });
  });
});
