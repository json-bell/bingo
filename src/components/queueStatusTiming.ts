// Split out from QueueStatus.tsx: a file that exports a component must only
// export components, or Fast Refresh's boundary detection breaks
// (react-refresh/only-export-components) -- unlike CheckedContext.tsx's
// useChecked (a justified exception for the standard Context+hook pairing),
// a plain timing constant has no inherent reason to live alongside the
// component at all.

// How long the "0 updates queued" success confirmation stays visible after
// the last queued write settles, fading out continuously over that window
// (not held solid then faded separately) before unmounting.
export const SUCCESS_FLASH_MS = 2000;
