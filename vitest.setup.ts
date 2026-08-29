import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./src/lib/msw/server";

// @testing-library/react normally auto-registers this itself, but only if
// it finds a *global* `afterEach` (checked at import time) -- this project
// doesn't set `test.globals: true`, so that detection silently no-ops and
// DOM from one test was leaking into the next for every test using
// `screen`-based (whole-document) queries rather than a `container`-scoped
// one. Existing tests never surfaced this because they all query through
// their own render()'s `container`, not `screen` -- found via a real
// "multiple elements found" failure once a test finally did.
afterEach(() => cleanup());

// Intercepts fetch() at the network layer (src/lib/checked.ts,
// src/lib/checkedQueue.ts) so the real request construction and response
// parsing get exercised and only the HTTP round-trip is faked -- see
// docs/backend-architecture.md §9. onUnhandledRequest: "error" makes an
// un-mocked request fail loudly instead of hanging.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom implements HTMLDialogElement (elements created from a <dialog> tag
// really are instances of it) but doesn't implement showModal()/close() at
// all — see docs/test-plan.md. This is the minimal faithful polyfill: toggle
// the `open` attribute, same as what showModal()/close() do in a real
// browser as far as anything in this app's tests can observe.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
