# Design system — mobile redesign

Source of truth for the mobile/desktop layout redesign planned in
[the design canvas](https://claude.ai/code/artifact/65c1b213-0356-4e0b-869e-d28ae9c71eb2)
(7 artboards, built from real `europapark-2024` data and the live "Deep Sea" palette). This
doc is the decisions that came out of reviewing that canvas — read it alongside the canvas,
not instead of it.

## Breakpoint strategy

**One breakpoint: Tailwind's built-in `md` (768px).** That's inside the ~700–900px band we
wanted, so there's no reason to invent a custom value — plain `md:` prefixes throughout.

- Below `md`: mobile layout.
- `md` and up: desktop layout.

This is two authored layouts, not a fluid continuum — don't add intermediate `sm:`/`lg:`
tweaks unless a real problem shows up at those widths later.

## Mobile layout (< md)

- **`AppBar.tsx`** (new, replaces `Header.tsx`): sticky top bar, trip title + a "Menu"
  button that opens `PersonMenu.tsx`.
- **`PersonMenu.tsx`** (new): a bottom sheet (native `<dialog>`, reusing the
  `ref`/`.showModal()`/`.close()`/backdrop-click pattern already established in
  `Tile.tsx`) listing all people as jump links. Also houses the `TintToggle` (moved out
  of its current fixed bottom-right position, which occludes grid content) and a
  difficulty-color legend (the app has never had one, and the tints are meaningless without
  it).
- **Grid padding before tile size.** First lever for narrow screens is reducing the padding
  around the grid/card, not shrinking the tiles — tiles stay square and at their current
  legible size. Only if that's insufficient does a later iteration look at shrinking tiles.
- **Horizontal scroll stays contained to the grid**, not the page or the whole card — the
  card's heading stays put while the grid slides underneath it.

## Desktop layout (≥ md)

Revised from the original plan: rather than swapping the menu button for an always-visible
inline person list, desktop keeps the **same "Menu" button** as mobile (simpler than
maintaining two separate nav UIs) — only the `PersonMenu` dialog's *shell* changes shape:
a bottom sheet below `md`, a centered modal (reusing `Tile.tsx`'s existing `m-auto`
centering pattern, capped to `md:max-w-md`) at `md` and up. Content inside (person list,
legend, tint toggle) is identical at both sizes.

## Component breakdown

| File | Change |
| --- | --- |
| `src/components/AppBar.tsx` | New. Sticky bar: trip title + a "Menu" button at every width. Replaces `Header.tsx`. |
| `src/components/PersonMenu.tsx` | New. One `<dialog>`: person list, `TintToggle`, difficulty legend — bottom sheet below `md`, centered modal at `md` and up. |
| `src/components/TintToggle.tsx` | Restyled: drop the fixed bottom-right positioning; render as a plain row inside `PersonMenu`. |
| `src/components/Tile.tsx` | Untouched this pass — the click → `<dialog>` interaction and `bgClass`-picks-one-string rule stay as-is. |
| `src/pages/TripPage.tsx` | Swaps `Header`/`Navigation` for `AppBar`/`PersonMenu`; per-card scroll container is scoped to the grid wrapper, not the whole `<li>`; drops the accent-glow card shadow. |
| `src/pages/Home.tsx` | Not yet touched — still a follow-up. |
| `src/components/Navigation.tsx`, `src/components/Header.tsx` | Deleted. |

Untouched: `src/lib/trips.ts`, `src/App.tsx`, `types/trip.ts`, `config/`, `data/`, `grids/`.

A scroll-spy subtitle in `AppBar` (showing "whose grid am I on" while scrolling) was
considered but not built — sticky per-card name labels (`TripPage.tsx`'s `sticky top-16`
wrapper) cover that need instead. `Home.tsx`'s styling pass (deferred at the time this doc
was written) has since been done: it now uses the same `surface`/`brand` tokens as the rest
of the app, with a centered card-style link per trip.

## Tokens

No changes to `src/index.css`'s semantic token set — the redesign works within the existing
16 tokens (chrome separation uses alpha over existing tokens, e.g. `bg-background/85`,
`border-ink/10`, rather than new named tokens). The accent-glow card shadow
(`shadow-[0_0_10px_10px_var(--color-accent)]`) is dropped on mobile — it eats too much edge
space on a phone screen.

## Gotchas for the implementing session

- The bottom-sheet `<dialog>` needs to pin to the bottom, which **inverts** the documented
  `m-auto` centering fix in `CLAUDE.md` — done: `PersonMenu.tsx` uses `mt-auto` below `md`
  and `md:m-auto` (back to the standard centering fix) at `md` and up. See CLAUDE.md's
  `<dialog>` section.
- Don't combine `hidden` with `line-clamp-*` responsive variants carelessly — both are
  `display`-affecting utilities and CLAUDE.md already warns about two conflicting
  same-category utilities being present at once. If mobile ever needs to hide the
  description entirely, gate it with a single conditional class the way `Tile.tsx`
  already does for `bgClass`, not two co-present classes.
