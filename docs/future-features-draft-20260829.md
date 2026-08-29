## Shared decisions (answered 2026-08-29, before tackling items individually)

1. **Modal shell** — built as `src/components/Modal.tsx`, first used in `Tile.tsx`'s task
   modal. Everything scrolls together as one body, including the Name/title — the only
   persistently-visible thing is the close (X) button, which `Modal` renders itself:
   absolutely positioned top-right (`top-3 right-3`), 48px (`h-12 w-12`) circular touch
   target, thin `ink-muted/50` border, no shadow, `bg-surface` fill so it stays legible
   over whatever scrolls underneath. Verified to stay pinned there regardless of scroll
   position (tested against a long, scrolled description). No header/body split prop —
   consumers just pass children. Footer/button placement (e.g. Save/Cancel — pinned vs.
   scrolling with content) is left as a per-consumer detail, settled per feature as built.

   **Load-bearing gotcha, don't reintroduce**: the `<dialog>` element itself must get *no*
   `position` class (no `relative`, nothing) — `dialog:modal`'s native `position: fixed`
   (from the browser's own UA stylesheet) is what pins it to the viewport and is already a
   valid positioning context for the absolutely-positioned close button. A `relative` class
   was added once for exactly that positioning-context reason and silently broke the
   background-scroll lock (author CSS overrides a UA rule regardless of specificity — same
   class of gotcha as the `open:`/display one already documented in CLAUDE.md, just for
   `position`). Removing it fixed the regression with no other change needed.
2. **Menu structure** — worth settling now since three items below add to it. Proposed
   order, grouping related controls together: People (existing jump links) → Styling
   (difficulty legend + tint toggle, existing, with the new zoom-to-fill toggle joining
   this group) → Synchronisation info (new entry, opens the Sync Info modal) → Home (new,
   last since it's a "leave this page" action rather than an in-page setting). Open to
   reordering once it's actually built and looked at.
3. **"Last synced at" + "Sync Info modal"** — combined into a single feature/branch, not
   two. The tracking/storage layer has to exist before the modal can show anything, so
   they're sequential stages of one feature rather than independently parallelizable.

# Restyle the checked state:

- Replace the strikethrough with an absolutely positioned cross on top of the tile.
- Cross will be dark blue (new colour in the colour palette that we'll tweak separately)
- Initial version will keep it as simple as 2 divs diagonally across the square

# A "Zoom to fill" mode

2 modes:

- existing set up & layout, exactly preserved (scrolling overflow, etc.)
- Zoomed to fill - essentially scales the bingo grid to the full width, so that there's no overflow and no excess padding?

The exact CSS is an unresolved implementation detail specific to this feature (not a
blocker for anything else) — start it and verify manually as we go rather than planning
the CSS up front.

This toggles in the menu, in the Styling section (see shared decision #2 above).

# Restyle of the task modals / details

Just a change in the layout - right now it's a flex that kind of sits

```
Name   | X
Title  |
---------
Description
Check
Buttons
```

And instead I want more of a larger Name | X first layout (X top right, name top left) and the rest centered

```
Name | X
--------
Title
Desc
...
```

The X becomes the shared `Modal` component's own floating close button (see shared
decision #1 above); Name scrolls with the rest of the content underneath it.

# Back to trips (Home `/` button)

Pretty simple, in the menu we want a button that goes back to the home page. Placement:
last item in the menu (see shared decision #2 above).

# Last online at \_\_\_. Trying to connect + Sync Info modal

(One feature, one branch — see shared decision #3 above; the two halves below are
sequential stages of it, not separate items.)

## Stage 1: last-synced tracking

Essentially for when the queue is waiting to connect then a "Last synced at" type of flag would be good, even if there's 0 elements in the queue (so that we can keep the time of the most recent successful GET essentially, once one of them has failed)

This needs some further digging,

- Localstorage? Store time everytime a successful GET for the checked status comes through - and then every time a checked status fails
- Display - can we show this even when there's queued things or does that get too cramped?

## Stage 2: Sync Info modal

Clicking the "N waiting to update" or directly a "Synchronisation info" in the Menu opens a "Sync info" modal with

- last synced at (latest successful GET)
  - Should this only display if there's a more recent GET that has failed?
  - Up to date :tick: if the most recent GET is a successful one?
  - Display both a latest successful GET and latest unsuccessful GET? For maximum visibility
- Queue count (number of waiting PATCHes)
- List of individual awaiting PATCHes
  - When the status is offline (there aren't any pending requests) then should we have a Remove button that removes the update from the queue - so a user can then remove specific updates that weren't intentional
  - Organised by Name > turning On/Off > displaying the title of the checkbox
- Uses the shared `Modal` component (see shared decision #1 above) for the max-height/scroll behavior.
