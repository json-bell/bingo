import { describe, it, expect } from "vitest";
import { formatSyncTime } from "./formatSyncTime";

describe("formatSyncTime", () => {
  it("formats an afternoon time today as 'h:mmam/pm, today'", () => {
    const now = new Date(2026, 7, 30, 18, 0);
    expect(formatSyncTime(new Date(2026, 7, 30, 15, 12).toISOString(), now)).toBe("3:12pm, today");
  });

  it("formats a morning time as am, and pads single-digit minutes", () => {
    const now = new Date(2026, 7, 30, 10, 0);
    expect(formatSyncTime(new Date(2026, 7, 30, 9, 4).toISOString(), now)).toBe("9:04am, today");
  });

  it("formats noon and midnight as 12pm/12am, not 0", () => {
    const now = new Date(2026, 7, 30, 23, 0);
    expect(formatSyncTime(new Date(2026, 7, 30, 12, 0).toISOString(), now)).toBe("12:00pm, today");
    expect(formatSyncTime(new Date(2026, 7, 30, 0, 0).toISOString(), now)).toBe("12:00am, today");
  });

  it("formats yesterday's date as 'yesterday'", () => {
    const now = new Date(2026, 7, 30, 9, 0);
    expect(formatSyncTime(new Date(2026, 7, 29, 21, 34).toISOString(), now)).toBe("9:34pm, yesterday");
  });

  it("formats older dates as 'N days ago'", () => {
    const now = new Date(2026, 7, 30, 9, 0);
    expect(formatSyncTime(new Date(2026, 7, 27, 15, 12).toISOString(), now)).toBe("3:12pm, 3 days ago");
  });

  it("treats a same-day boundary correctly regardless of exact time-of-day gap", () => {
    const now = new Date(2026, 7, 30, 0, 5);
    expect(formatSyncTime(new Date(2026, 7, 30, 0, 1).toISOString(), now)).toBe("12:01am, today");
  });
});
