import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../lib/msw/server";
import { TripPage } from "./TripPage";

// The two integration tests below: real fixture data, real components, no
// mocked context -- this is what would catch a broken wiring between Tile,
// CheckedContext, and checked.ts that the unit tests of each piece in
// isolation wouldn't (see docs/test-plan.md). fetch() is intercepted at the
// network layer via msw, not mocked at the function level -- these go
// *through* the checked.ts/checkedQueue.ts seam, not around it.

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

  it("Save commits the checked state to the rendered tile and sends a PATCH", async () => {
    let patchedBody: { id: string; checked: boolean } | undefined;
    server.use(
      http.patch("/api/checked", async ({ request }) => {
        patchedBody = (await request.json()) as { id: string; checked: boolean };
        return HttpResponse.json({
          id: patchedBody.id,
          checked: patchedBody.checked,
          updatedAt: new Date().toISOString(),
        });
      })
    );

    const { user, container, tile, checkbox } = await renderTripPageAndOpenFirstTile();

    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    await user.click(findButtonByText(container, "dialog[open] button", "Save"));

    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(tile.querySelector('[aria-hidden="true"]')).not.toBeNull();

    await waitFor(() => expect(patchedBody).toBeDefined());
    expect(patchedBody?.checked).toBe(true);
  });

  it("Cancel discards the toggle and sends no PATCH", async () => {
    let patchCalled = false;
    server.use(
      http.patch("/api/checked", async ({ request }) => {
        patchCalled = true;
        const body = (await request.json()) as { id: string; checked: boolean };
        return HttpResponse.json({ id: body.id, checked: body.checked, updatedAt: new Date().toISOString() });
      })
    );

    const { user, container, tile, checkbox } = await renderTripPageAndOpenFirstTile();

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    await user.click(findButtonByText(container, "dialog[open] button", "Cancel"));

    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(tile.querySelector('[aria-hidden="true"]')).toBeNull();

    // No clean "wait for nothing to happen" idiom -- give an (incorrect)
    // PATCH a real chance to fire before asserting none did.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(patchCalled).toBe(false);
  });
});
