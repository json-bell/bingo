import { describe, it, expect, beforeEach } from "vitest";
import { isSyncFailed, readSyncStatus, recordSyncFailure, recordSyncSuccess } from "./syncStatus";

describe("syncStatus", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads an empty status for a trip that has never recorded anything", () => {
    expect(readSyncStatus("trip")).toEqual({});
  });

  it("records a success without disturbing a different trip's status", () => {
    recordSyncSuccess("trip-a");
    expect(readSyncStatus("trip-b")).toEqual({});
  });

  it("keeps the earlier lastSuccessAt when only a failure is recorded afterward", () => {
    recordSyncSuccess("trip");
    const { lastSuccessAt } = readSyncStatus("trip");
    recordSyncFailure("trip");
    expect(readSyncStatus("trip").lastSuccessAt).toBe(lastSuccessAt);
    expect(readSyncStatus("trip").lastFailureAt).toBeDefined();
  });

  describe("isSyncFailed", () => {
    it("is false with no failure recorded", () => {
      expect(isSyncFailed({})).toBe(false);
      expect(isSyncFailed({ lastSuccessAt: "2026-01-01T00:00:00.000Z" })).toBe(false);
    });

    it("is true when a failure exists and no success has ever landed", () => {
      expect(isSyncFailed({ lastFailureAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    });

    it("is true when the failure is newer than the last success", () => {
      expect(
        isSyncFailed({
          lastSuccessAt: "2026-01-01T00:00:00.000Z",
          lastFailureAt: "2026-01-02T00:00:00.000Z",
        })
      ).toBe(true);
    });

    it("is false when a later success supersedes an earlier failure", () => {
      expect(
        isSyncFailed({
          lastFailureAt: "2026-01-01T00:00:00.000Z",
          lastSuccessAt: "2026-01-02T00:00:00.000Z",
        })
      ).toBe(false);
    });
  });
});
