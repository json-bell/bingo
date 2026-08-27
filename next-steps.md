Here are some next steps:

This is a scratchpad md file that should actively be overwritten as tasks become completed.

## Mobile (done)

Nav bar now wraps (`flex flex-wrap`) instead of forcing a single row, and each grid scrolls
horizontally on its own (`overflow-x-auto` wrapper in `Grid.tsx`) if it's wider than the
viewport.

## Visibility (done)

Added a "Tints" toggle switch (`TintToggle.tsx`), fixed to the bottom-right corner. State
lives in `TripPage.tsx`, persisted to localStorage, and threaded down through `Grid` to
`BingoItem`, which falls back to the plain `bg-tile` color for every cell when disabled.
