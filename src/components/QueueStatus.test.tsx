import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueueStatus } from "./QueueStatus";
import { SUCCESS_FLASH_MS } from "./queueStatusTiming";
import { useChecked } from "../context/CheckedContext";

vi.mock("../context/CheckedContext", () => ({
  useChecked: vi.fn(),
}));

const mockedUseChecked = vi.mocked(useChecked);

function mockContext(
  queuedCount: number,
  isSending: boolean,
  syncFailed = false,
  lastSyncedAt?: string,
  isInitialLoading = false
) {
  mockedUseChecked.mockReturnValue({
    isChecked: () => false,
    updateChecked: () => {},
    queuedCount,
    queuedWrites: [],
    removeQueued: () => {},
    isSending,
    syncFailed,
    lastSyncedAt,
    isInitialLoading,
  });
}

const noop = () => {};

describe("QueueStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when the queue is empty", () => {
    mockContext(0, false);
    const { container } = render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a 'Loading…' pill while the initial checked-state GET is still in flight", () => {
    mockContext(0, false, false, undefined, true);
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("prefers the loading pill over the failed-GET pill when both are true", () => {
    // isInitialLoading only ever coincides with a failure once the initial
    // GET has actually settled, but the loading state should still win if
    // a stale syncFailed from a previous mount happened to be true.
    mockContext(0, false, true, "2026-08-30T12:24:00.000Z", true);
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/Last connected/)).not.toBeInTheDocument();
  });

  it("shows '{N} updates sending…' while a drain this context started is still sending", () => {
    mockContext(2, true);
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("2 updates sending…")).toBeInTheDocument();
  });

  it("shows '{N} updates queued, no connection' when queued but nothing is currently in flight", () => {
    mockContext(3, false);
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("3 updates queued, no connection")).toBeInTheDocument();
  });

  it("uses the singular 'update' (not 'updates') for a count of exactly 1", () => {
    mockContext(1, true);
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("1 update sending…")).toBeInTheDocument();
  });

  it("shows the success confirmation on the >0 -> 0 transition, then unmounts after SUCCESS_FLASH_MS", () => {
    mockContext(1, true);
    const { rerender, container } = render(<QueueStatus onOpenSyncInfo={noop} />);

    act(() => {
      mockContext(0, false);
      rerender(<QueueStatus onOpenSyncInfo={noop} />);
    });

    expect(screen.getByText("All synced :D")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SUCCESS_FLASH_MS);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("switches back to the sending pill if a new update is queued while the success flash is still showing", () => {
    // Regression guard: the success flash's render guard previously checked
    // only `showSuccess`, never `queuedCount` -- so a new write queued
    // mid-fade kept showing "All synced :D" instead of the real state,
    // right up until the *original* flash's own timer happened to clear it.
    mockContext(1, true);
    const { rerender, container } = render(<QueueStatus onOpenSyncInfo={noop} />);

    act(() => {
      mockContext(0, false);
      rerender(<QueueStatus onOpenSyncInfo={noop} />);
    });
    expect(screen.getByText("All synced :D")).toBeInTheDocument();

    // A new update queued before the flash's own timer has elapsed.
    act(() => {
      mockContext(1, true);
      rerender(<QueueStatus onOpenSyncInfo={noop} />);
    });

    expect(screen.queryByText("All synced :D")).not.toBeInTheDocument();
    expect(screen.getByText("1 update sending…")).toBeInTheDocument();

    // The stale flash timer (if it fired) must not resurrect the old view.
    act(() => {
      vi.advanceTimersByTime(SUCCESS_FLASH_MS);
    });
    expect(container).not.toHaveTextContent("All synced :D");
    expect(screen.getByText("1 update sending…")).toBeInTheDocument();
  });

  it("does not show the success flash when the queue was already empty (no transition happened)", () => {
    mockContext(0, false);
    const { rerender, container } = render(<QueueStatus onOpenSyncInfo={noop} />);

    act(() => {
      mockContext(0, false);
      rerender(<QueueStatus onOpenSyncInfo={noop} />);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a 'Last connected' pill when the queue is empty but the checked-state GET has failed", () => {
    mockContext(0, false, true, "2026-08-30T12:24:00.000Z");
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText(/Last connected/)).toBeInTheDocument();
  });

  it("falls back to 'Not yet connected' when the GET has failed and never once succeeded", () => {
    mockContext(0, false, true, undefined);
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("Not yet connected")).toBeInTheDocument();
  });

  it("prefers the queued-updates pill over the failed-GET pill when both are true", () => {
    mockContext(2, false, true, "2026-08-30T12:24:00.000Z");
    render(<QueueStatus onOpenSyncInfo={noop} />);
    expect(screen.getByText("2 updates queued, no connection")).toBeInTheDocument();
    expect(screen.queryByText(/Last connected/)).not.toBeInTheDocument();
  });
});
