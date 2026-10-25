# Art direction: "Chart table"

Bridge Calculators should feel like instruments on a chart table: calm, exact, readable at 3 a.m. under a red light, and obviously made by iMariners. Every tool is a page of the same product, not a separate page.

## One idea
A navy console on the left, a clean chart-paper work area on the right. Navy is the instrument frame. White cards are the chart sheets. Teal is the iMariners brand and the only action colour. Amber marks a cell you type into. Red and green keep their seafaring meaning (port and starboard, take and avoid, west and east).

## Layout (every page)
1. **Sidebar** (264 px, navy): iMariners logo on a white plate, then the tools in five groups (Celestial and compass, Passage planning, Watch and reporting, Ship handling, Settings). One line per tool, icon in a fixed 20 px column, the page you are on has a lighter panel and a teal bar on the edge. Footer: "Planning aid only, not for navigation" and the GitHub link.
2. **Top bar** (56 px, white): where you are (group / page), the "Saved" mark, the ship, and the Day / Dusk / Night switch. On a phone the sidebar becomes a drawer opened by the menu button.
3. **Page header**: the page title (28 px), one sentence about what the tool is for, and a thin ruler of tick marks under it, like the scale on a chart. Nothing else sits above the first card.
4. **Cards**: white, 1 px border, 12 px corners. The title of a card is a small mono capital label with a teal square, like a legend on a chart. Every card on every page has the same anatomy.
5. **Content width**: 1320 px maximum, same left edge on every page.

## Type
- **Geist** for all text, **Geist Mono** for labels, card titles, coordinates and anything that must line up. Both are embedded in the file.
- Sizes only from the scale on the Design System page. Figures that matter (results) are large and teal; everything else is quiet.

## Colour roles
| Role | Use |
|---|---|
| Navy (`--side-bg`, `--matrix-head`) | Sidebar, table header bands |
| Teal (`--accent`, `--brand`) | Buttons, links, selected, the card-title square |
| Amber tint (`--entry`) | A cell you type into |
| Teal figures (`--true`) | A calculated result |
| Red / green | Port / starboard, avoid / take, west / east, warnings and good news |

Night mode is red only, so it never spoils night vision. Dusk is the same layout in dark blue.

## Components (all in the Design System page)
Buttons (primary, default, danger), fields (label above, unit inside), segmented choice, readout boxes, tables (navy header for matrices, quiet header for lists), verdict pills (TAKE, OK, AVOID), callouts, the map. New components must be built from the tokens, never from one-off values.

## Rules
- No colour code, font name, pixel text size or pixel corner in component CSS. The Design System page has a **Run check** that must say Clean.
- Do not invent a new page layout. Start from the page header and cards above; add a second column only when the tool needs inputs and results side by side.
- Print sheets are plain black and white on purpose and are the only exception to the colour rules.
