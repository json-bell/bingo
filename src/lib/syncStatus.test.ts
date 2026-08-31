import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isResponseFresh,
  isSyncFailed,
  readSyncStatus,
  recordSyncFailure,
  recordSyncOutcome,
  recordSyncSuccess,
} from "./syncStatus";

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

  describe("isResponseFresh", () => {
    it("is true for a response generated just now", () => {
      expect(isResponseFresh(new Date().toISOString())).toBe(true);
    });

    it("is false for a response generated well past the staleness threshold", () => {
      expect(isResponseFresh(new Date(Date.now() - 60_000).toISOString())).toBe(false);
    });
  });

  describe("recordSyncOutcome", () => {
    // The bit this exists to protect: a resolved GET that happened while
    // genuinely offline, or while online but slower than the network
    // timeout (served from the service worker's NetworkFirst cache, per
    // vite.config.ts -- indistinguishable from a live response at the
    // fetch layer) must NOT be recorded as a fresh success, or the UI would
    // claim "Up to date" while actually showing stale data. isFresh is
    // passed in (normally the result of isResponseFresh above) rather than
    // computed here, so this is testable without touching a browser API or
    // constructing a real response.
    it("records a success and returns true when isFresh is true", () => {
      const result = recordSyncOutcome("trip", true);
      expect(result).toBe(true);
      expect(readSyncStatus("trip").lastSuccessAt).toBeDefined();
      expect(readSyncStatus("trip").lastFailureAt).toBeUndefined();
    });

    it("records a failure and returns false when isFresh is false, even though the GET resolved", () => {
      const result = recordSyncOutcome("trip", false);
      expect(result).toBe(false);
      expect(readSyncStatus("trip").lastFailureAt).toBeDefined();
      expect(readSyncStatus("trip").lastSuccessAt).toBeUndefined();
      expect(isSyncFailed(readSyncStatus("trip"))).toBe(true);
    });

    it("does not overwrite an earlier genuine success's timestamp when a later stale read comes in", () => {
      // Fake timers, with a real gap advanced between the two calls --
      // isSyncFailed compares timestamps with strict `>`, so two calls
      // fast enough to land in the same real millisecond would tie and
      // silently pass for the wrong reason otherwise.
      vi.useFakeTimers();
      try {
        recordSyncOutcome("trip", true);
        const { lastSuccessAt } = readSyncStatus("trip");
        vi.advanceTimersByTime(1000);
        recordSyncOutcome("trip", false);
        expect(readSyncStatus("trip").lastSuccessAt).toBe(lastSuccessAt);
        expect(isSyncFailed(readSyncStatus("trip"))).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
