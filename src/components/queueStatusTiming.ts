// Split out from QueueStatus.tsx: a file that exports a component must only
// export components, or Fast Refresh's boundary detection breaks
// (react-refresh/only-export-components) -- unlike CheckedContext.tsx's
// useChecked (a justified exception for the standard Context+hook pairing),
// a plain timing constant has no inherent reason to live alongside the
// component at all.

// Total time the "0 updates queued" success confirmation stays mounted
// after the last queued write settles: SUCCESS_HOLD_MS at full opacity,
// then it fades over the remainder, before unmounting.
export const SUCCESS_FLASH_MS = 2000;

// How long the confirmation stays fully visible before it starts fading --
// a CSS transition-delay, not a JS setTimeout: the fade's own trigger
// (flipping to opacity-0) still fires on the next animation frame after
// mount, same as before. The delay is what makes the browser hold the
// value unchanged until it elapses, then animate over the rest of the
// window -- no JS timing changes needed for the "hold, then ease" shape.
export const SUCCESS_HOLD_MS = 1000;
