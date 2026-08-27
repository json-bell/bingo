import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { TripPage } from "./TripPage";

// The two integration tests below: real fixture data, real components, no
// mocked context — this is what would catch a broken wiring between Tile,
// CheckedContext, and checked.ts that the unit tests of each piece in
// isolation wouldn't (see docs/test-plan.md).

function findButtonByText(container: HTMLElement, selector: string, text: string): HTMLElement {
  const match = Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
    (button) => button.textContent?.trim() === text
  );
  if (!match) throw new Error(`button "${text}" not found`);
  return match;
}

async function renderTripPageAndOpenFirstTile() {
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

  return { user, container, tile, checkbox };
}

describe("TripPage: checking a cell end to end", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Save commits the checked state to both the rendered tile and localStorage", async () => {
    const { user, container, tile, checkbox } = await renderTripPageAndOpenFirstTile();

    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    await user.click(findButtonByText(container, "dialog[open] button", "Save"));

    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(tile.querySelector("h3")).toHaveClass("line-through");

    const storedKey = Object.keys(localStorage).find((key) =>
      key.startsWith("bingo:checked:europapark-2024:")
    );
    expect(storedKey).toBeDefined();
    const storedValue = JSON.parse(localStorage.getItem(storedKey as string) ?? "{}");
    expect(Object.values(storedValue)).toContain(true);
  });

  it("Cancel discards the toggle and persists nothing", async () => {
    const { user, container, tile, checkbox } = await renderTripPageAndOpenFirstTile();

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    await user.click(findButtonByText(container, "dialog[open] button", "Cancel"));

    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(tile.querySelector("h3")).not.toHaveClass("line-through");

    const storedKey = Object.keys(localStorage).find((key) =>
      key.startsWith("bingo:checked:europapark-2024:")
    );
    expect(storedKey).toBeUndefined();
  });
});
