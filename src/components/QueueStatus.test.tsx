import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueueStatus } from "./QueueStatus";
import { SUCCESS_FLASH_MS } from "./queueStatusTiming";
import { useChecked } from "../context/CheckedContext";

vi.mock("../context/CheckedContext", () => ({
  useChecked: vi.fn(),
}));

const mockedUseChecked = vi.mocked(useChecked);

function mockContext(queuedCount: number, isSending: boolean) {
  mockedUseChecked.mockReturnValue({
    isChecked: () => false,
    updateChecked: () => {},
    queuedCount,
    isSending,
  });
}

describe("QueueStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when the queue is empty", () => {
    mockContext(0, false);
    const { container } = render(<QueueStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Updating N…' while a drain this context started is still sending", () => {
    mockContext(2, true);
    render(<QueueStatus />);
    expect(screen.getByText("Updating 2…")).toBeInTheDocument();
  });

  it("shows 'N queued, waiting to sync' when queued but nothing is currently in flight", () => {
    mockContext(3, false);
    render(<QueueStatus />);
    expect(screen.getByText("3 queued, waiting to sync")).toBeInTheDocument();
  });

  it("shows the success confirmation on the >0 -> 0 transition, then unmounts after SUCCESS_FLASH_MS", () => {
    mockContext(1, true);
    const { rerender, container } = render(<QueueStatus />);

    act(() => {
      mockContext(0, false);
      rerender(<QueueStatus />);
    });

    expect(screen.getByText("0 updates queued")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SUCCESS_FLASH_MS);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("does not show the success flash when the queue was already empty (no transition happened)", () => {
    mockContext(0, false);
    const { rerender, container } = render(<QueueStatus />);

    act(() => {
      mockContext(0, false);
      rerender(<QueueStatus />);
    });

    expect(container).toBeEmptyDOMElement();
  });
});
