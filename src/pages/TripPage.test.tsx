import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { TripPage } from "./TripPage";

// The one integration test: real fixture data, real components, no mocked
// context — this is what would catch a broken wiring between Tile,
// CheckedContext, and checked.ts that the unit tests of each piece in
// isolation wouldn't (see docs/test-plan.md).
describe("TripPage: checking a cell end to end", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("updates both the rendered tile and localStorage when a cell is checked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={["/europapark-2024"]}>
        <Routes>
          <Route path="/:slug" element={<TripPage />} />
        </Routes>
      </MemoryRouter>
    );

    const tile = await waitFor(() => {
      const el = container.querySelector('[role="button"]');
      if (!el) throw new Error("tile not rendered yet");
      return el as HTMLElement;
    });

    await user.click(tile);

    const checkbox = await waitFor(() => {
      const el = container.querySelector('dialog[open] input[type="checkbox"]');
      if (!el) throw new Error("dialog not open yet");
      return el as HTMLInputElement;
    });

    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const closeButton = container.querySelector(
      'dialog[open] button[aria-label="Close"]'
    ) as HTMLElement;
    await user.click(closeButton);

    expect(tile.querySelector("h3")).toHaveClass("line-through");

    const storedKey = Object.keys(localStorage).find((key) =>
      key.startsWith("bingo:checked:europapark-2024:")
    );
    expect(storedKey).toBeDefined();
    const storedValue = JSON.parse(localStorage.getItem(storedKey as string) ?? "{}");
    expect(Object.values(storedValue)).toContain(true);
  });
});
