import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../lib/msw/server";
import { CheckedProvider, useChecked } from "./CheckedContext";

// Real CheckedProvider + msw (network-layer interception, not a stubbed
// context value), same "seam not mock" approach as Grid.test.tsx.

function Probe({ cellId }: { cellId: string }) {
  const { isChecked, updateChecked, queuedCount, removeQueued } = useChecked();
  return (
    <div>
      <span data-testid="checked">{String(isChecked(cellId))}</span>
      <span data-testid="queued">{queuedCount}</span>
      <button onClick={() => updateChecked(cellId, true)}>toggle</button>
      <button onClick={() => removeQueued(cellId)}>remove</button>
    </div>
  );
}

describe("CheckedContext: removing a queued write", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("reverts the optimistic checked state once its queued write is removed", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/api/trips/:slug/checked", () =>
        HttpResponse.json({ slug: "trip", version: 1, cells: {}, generatedAt: new Date().toISOString() })
      ),
      // Never succeeds, so the write this test enqueues stays queued instead
      // of draining out from under the assertion.
      http.patch("/api/checked", () => HttpResponse.json({}, { status: 503 }))
    );

    render(
      <CheckedProvider tripSlug="trip" version={1}>
        <Probe cellId="cell-1" />
      </CheckedProvider>
    );

    // Let the initial GET (mount effect) settle before toggling.
    await waitFor(() => expect(screen.getByTestId("checked")).toHaveTextContent("false"));

    await user.click(screen.getByText("toggle"));
    await waitFor(() => expect(screen.getByTestId("queued")).toHaveTextContent("1"));
    expect(screen.getByTestId("checked")).toHaveTextContent("true");

    await user.click(screen.getByText("remove"));
    await waitFor(() => expect(screen.getByTestId("queued")).toHaveTextContent("0"));

    // The queued write is gone, but nothing reverted the optimistic value
    // it was carrying -- the cell should go back to server truth (false).
    expect(screen.getByTestId("checked")).toHaveTextContent("false");
  });
});
