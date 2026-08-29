# Restyle the checked state:

- Replace the strikethrough with an absolutely positioned cross on top of the tile.
- Cross will be dark blue (new colour in the colour palette that we'll tweak separately)
- Initial version will keep it as simple as 2 divs diagonally across the square

# A "Zoom to fill" mode

2 modes:

- existing set up & layout, exactly preserved (scrolling overflow, etc.)
- Zoomed to fill - essentially scales the bingo grid to the full width, so that there's no overflow and no excess padding?

Think we need to iron out the exact CSS details on this one for the actual appearance.

This can be toggled in the menu similar to the difficulty tinting, we can have a section for styling there in the menu

In the menu (and the modals generally) - do we want a max like height of the modal and make the inside scrollable?

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

# Back to trips (Home `/` button)

Pretty simple, in the menu we want a button that goes back to the home page

# Last online at \_\_\_. Trying to connect

Essentially for when the queue is waiting to connect then a "Last synced at" type of flag would be good, even if there's 0 elements in the queue (so that we can keep the time of the most recent successful GET essentially, once one of them has failed)

This needs some further digging,

- Localstorage? Store time everytime a successful GET for the checked status comes through - and then every time a checked status fails
- Display - can we show this even when there's queued things or does that get too cramped?

Follows into the Sync Info modal:

# Sync Info modal

Clicking the "N waiting to update" or directly a "Synchronisation info" in the Menu opens a "Sync info" modal with

- last synced at (latest successful GET)
  - Should this only display if there's a more recent GET that has failed?
  - Up to date :tick: if the most recent GET is a successful one?
  - Display both a latest successful GET and latest unsuccessful GET? For maximum visibility
- Queue count (number of waiting PATCHes)
- List of individual awaiting PATCHes
  - When the status is offline (there aren't any pending requests) then should we have a Remove button that removes the update from the queue - so a user can then remove specific updates that weren't intentional
  - Organised by Name > turning On/Off > displaying the title of the checkbox
- Again modal size is relevant - we probably want a max height based on % of screen height, with vertical scrolling of inner content if it overflows
