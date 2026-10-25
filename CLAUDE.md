# Bridge Calculators: project notes (read this first)

One offline HTML file, `Bridge-Calculators.html`, that replaces the Excel sheets a deck officer uses on board. Works from a double-click, no internet, no server.

## Where things are
- **`Bridge-Calculators.html`** is the source of truth. After every change, copy it to `~/Desktop/Bridge-Calculators.html` (the copy used on board).
- Version control is git, remote `iMariner/imariners-bridge-calculators` on GitHub (public, MIT). **After every finished change: commit with a clear message and push.** The owner asked for everything to stay up to date on GitHub.
- `build/` has the scripts and tests used to build and verify each tool (see "Verification").
- `data/` has the packed data that is embedded in the HTML (special areas, coastline, a comparison table).
- The tools were ported from a macro-free Excel compass error workbook; the maths was checked against astropy.
- Verified special-area coordinates come from `~/Developer/iMariners/sea-areas/data/*.json` (do not retype coordinates, rebuild from there).

## Look and feel
Read `ART-DIRECTION.md` first for any visual work ("Chart table": navy sidebar, white cards, teal brand, ruler under each page title, mono card titles). Every tool page has the same parts: page header, then cards that each start with an `h2` title. Do not invent a new layout. Review screenshots with `node build/tools/shot.js <outDir> [width] [height] [day|dusk|night]` (headless Chrome, example data in every tool) and check print sheets with `node build/tools/printpdf.js <tool-id> <example-button-id> <out.pdf>`. The Design System page has the live tokens and the compliance check.

## Sight engine (build/sight): celestial fix, in progress
`engine.js` holds the block `SIGHT-BEGIN/END` (not yet in the HTML): 58 navigational stars (Hipparcos J2000 + proper motion, `cat_j2000.json` is the source), apparent places with precession, nutation and aberration, the Sun from truncated VSOP87D, Hs to Ho (dip, Bennett refraction with T and P, SD, parallax), Hc and Zn. Plan: `docs/PLAN-sight-fix.md` (local). Tests: `node build/sight/test_engine.js` (24 checks incl. Nautical Almanac correction tables), `node build/sight/test_workbook.js` (the owner's CEL NAV.xls example), and the ERFA comparison: `node build/sight/gen_cases.js > /tmp/c.json; python3 build/sight/compare_erfa.py /tmp/c.json build/sight/cat_j2000.json` (needs astropy). Result on 600 random cases: Sun within 0.006', stars within 0.013' (minutes of arc). `fix.js` (block `SIGHTFIX`, not yet in the HTML) is the running-fix solver; tests: `node build/sight/test_fix.js` (316 checks: synthetic round trips, constant error, noon latitude, date line, weak cut, high latitude, brute-force least-squares comparison, rhumb propagation against an independent formula, owner's workbook geometry). Both phases were independently reviewed by Codex and an Opus agent; their findings are fixed. Note: the owner's workbook refraction is about 33% too large because its constant is for pressure in mmHg but it is fed millibars.

## Old browsers (ship PCs never get updates)
The page must work on any Chrome or Edge from version 84 (2020) on, because ship PCs are offline and their browsers are frozen. Rules: no `color-mix()` (use the precomputed `--*-rgb` and `--tint-*` tokens), no `inset:` shorthand, no `:has()`, no modern JS (the script is written in plain ES5 style). A banner appears on older browsers. Test with a real old Chromium: `curl -O https://commondatastorage.googleapis.com/chromium-browser-snapshots/Mac/768968/chrome-mac.zip` (Chromium 84), unzip, `xattr -cr`, then `CHROME=<path>/Chromium.app/Contents/MacOS/Chromium HEADLESS=--headless node build/tools/shot.js <outDir>`. `build/tools/theme-colours.js` prints the theme colours used to precompute the tint tokens.

## How the file is organised
1. `<style>`: first the **DESIGN SYSTEM** (colour tokens now include the sidebar `--side-*`, `--border-strong`, `--matrix-head`) (Geist and Geist Mono embedded as base64, colour tokens for Day / Dusk / Night, type, spacing, radius scales), then component CSS, then one block per tool.
2. `<body>`: header, side navigation (`data-tool-link`), `<main>` with one `<section class="tool" id="...">` per tool. A tool's print sheet is a `.print-sheet` child of its section.
3. `<script>` (one IIFE): `store` (localStorage, key prefix `bridgeCalc.`), `Ships`, the almanac engine (`ASTRO-BEGIN/END`), calculation blocks with begin/end markers (`REPORTS-`, `SUN-`, `GEO-`, `ETA-`, `CALC-`), one `initXxx()` per tool, the embedded data blobs (`SA_AREAS`, `SA_LAND`, `SA_SHEET`), then the `TOOLS` registry and hash routing.

Tools now: True Wind, Meridian Passage, Sunrise & Sunset, Special Areas & Map, Gyro & Compass Error (includes the true azimuth working), Deviation Card, Course & Speed Made Good, ETA, Vessel Daily Reportings, Draught due to Heel, Safe Anchoring Depth, Ship Particulars, Design System. (True Azimuth still exists at `#true-az` but is hidden from the menu.)

## Rules that must hold
- **Design system only.** No hex colours, font names, px font sizes or px radii in component CSS or inline styles; use `var(--token)` and the `u-*` helper classes. Night theme is red only. After any change open the **Design System** page and press **Run check**: it must say Clean.
- **Saves automatically, like Excel.** Every input goes through `store.get/set` under a `bridgeCalc.` key. Per ship data is keyed by `Ships.active().id`. No download buttons in the normal flow (the owner does not want extra files).
- **Never mark something verified that is not.** Coordinates are exactly as printed in the IMO texts with the source shown; points derived from the coastline are flagged COAST POINT.
- **Wording:** short answers, plain words, no em dashes in anything the owner reads (user rule for iMariners content).
- Every result that a mistake could hurt (sun times, areas, distances) must be tested against an independent source, not only against itself.
- Work in subagents inside one conversation, never separate sessions (global rule).

## Check after every edit
```bash
node -e "var h=require('fs').readFileSync('Bridge-Calculators.html','utf8');new Function(h.slice(h.lastIndexOf('<script>')+8,h.lastIndexOf('</script>')));console.log('js ok')"
cp Bridge-Calculators.html ~/Desktop/Bridge-Calculators.html
```
Test in a browser: `python3 -m http.server 8790` in this folder, open `http://localhost:8790/Bridge-Calculators.html#<tool-id>`. Widths above the pane size: headless Chrome, `--window-size=1600,1500 --screenshot=...`.

## How to add a tool
1. Back up. 2. Add the nav link (`<a href="#id" data-tool-link="id">`) and a `<section class="tool" id="id" hidden>` using `.tool-head`, `.grid` / `.tool-layout`, `.card`. 3. Write `initId()` and add it to `TOOLS`. 4. Keep pure maths in a block with begin/end markers so node can test it. 5. Save inputs with `store`. 6. Run the Design System check. 7. Add a one-page `.print-sheet` if the owner would print the result.
The `build/*/patch.py` files show the pattern used so far: a Python script with `assert`ed string replacements that fails safely if the file changed. They were already applied; they are kept as examples only (paths inside point to old temporary folders).

## Verification and how accurate each tool is
| Tool | How it was checked | Result |
|---|---|---|
| Sunrise & Sunset | `build/sun/cmp2.py` against astropy with a full planetary ephemeris, 422 events, 60 random cases from 60S to 66N | max 10.7 s, median about 1 s. Needs a Python venv with astropy. |
| Vessel Daily Reportings | `node build/reports/test.js` (the user's 500 to 240 NM example, zone change, DTG increase, month totals) | all pass |
| Positions and map maths | `node build/geo/test.js` (parser, formatting, point in area, distance to a line) | all pass |
| Special areas | regions built by `build/special-areas/build.py` (needs `shapely`, Natural Earth 10m land: `raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson`, and 50m for the display coast), then `pack.py`. 25 inside/outside tests passed, including either side of each boundary line. | see notes below |
| True azimuth, gyro and compass error, meridian passage | ported from the Excel sheet and compared with astropy during the build | agree within the 0.1 degree of the almanac method |

Sunrise rule: upper limb with 34' refraction and the Sun's semi-diameter, rounded to the nearest minute (some websites cut the seconds, so they show a minute less). Twilight at -6, -12, -18 degrees.

## Known gaps and ideas
- Moon rise and set (only Sun is done). Other sea-areas layers from `sea-areas/data` (piracy HRA/VRA, IBF, JWC) are not in the map yet; the same map can show them.
- Special-area regions are drawn from straight lines between points; North American, US Caribbean and Canadian Arctic ECAs and the Suez box are geodesic in the regulations, difference is small.
