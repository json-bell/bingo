import "@testing-library/jest-dom/vitest";

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
