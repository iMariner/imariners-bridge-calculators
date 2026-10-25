# iMariners Bridge Calculators

One offline HTML file with the calculations a deck officer repeats on the bridge. Download `Bridge-Calculators.html`, double-click it, and it works in Chrome or Edge with no internet and nothing to install. Everything typed is saved automatically in the browser, like an Excel sheet that remembers.

**Tools:** True Wind, Meridian Passage, Sunrise & Sunset, Special Areas & Map, Gyro & Compass Error (with every step of the working), Deviation Card, Course & Speed Made Good, ETA to several destinations at several speeds, Vessel Daily Reportings (noon reports and month-end distances), Draught due to Heel, Safe Anchoring Depth. Day, Dusk and Night (red only) themes. One-page print sheets.

**Accuracy is checked, not assumed.** Sunrise and sunset were compared with a full planetary ephemeris over 422 events (largest difference 11 seconds). Special area coordinates are exactly as printed in the IMO texts, each with its source; points that come from the coastline are marked as such. See `CLAUDE.md` for how each tool was verified.

**Planning aid only, not for navigation.** Always use official publications and your own judgement.

## For contributors
Read `CLAUDE.md` first: how the file is organised, the design system rules, how to add a tool and how to verify it. The special-area data is built from verified records of the IMO regulations (coordinates copied exactly, with sources); the build scripts are in `build/special-areas`.

MIT licence for the code (see `LICENSE`). Fonts and map data: see `THIRD-PARTY-NOTICES.md`. The iMariners name and logo are not covered by the licence.
