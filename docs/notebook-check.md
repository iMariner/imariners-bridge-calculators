# Old notebook pages: checked against the app

Checked 29-30 Oct 2026. Every worked example was run through the app's own engines. Test: `node build/tools/test_notebook.js` (34 checks, all with the corrected answers below).

## Corrections

| Page | Notebook | Correct | What went wrong |
|---|---|---|---|
| Sun sight 9 Oct 2019, 13°03.0'N 094°07.9'E, Hs 20°13.6' | AA 20°23.2', Ho 20°36.9', intercept 15.9' Towards | AA 20°04.0', Ho 20°17.5', intercept **3.4' Away**, Zn 101.7° | Dip was added. Dip is always subtracted: AA = OA − dip. |
| Sun sight 8 Oct 2019 0126 UT, 16°01.9'N 092°00.6'E: observed position | 15°36.7'N 092°27.8'E (d'lat 25.2' S, d'long 27.2' E) | **15°54.7'N 092°30.9'E** (ITP) | From the intercept 29.9' on 103.8°: d'lat = 29.9 × cos 103.8° = 7.1' S, dep = 29.0' E, d'long = 30.2' E. One sight gives a position line through this point, not a fix. |
| Plane sailing 01°48.0'S 012°47.0'E, 145° T, 155 NM | 03°37.6'S 014°36.7'E | **03°55.6'S 014°15.9'E** (plane sailing 03°55.0'S 014°16.0'E) | Course taken as S45°E. 180 − 145 = 35, so S35°E. |
| Plane sailing 18°02.0'S 178°20.0'E to 20°19.0'S 175°25.0'W | 111° T, 382.3 NM | 111.1° T, **379.8 NM** | Course rounded to 69° before dividing. Keep the full angle, or use dist = √(d'lat² + dep²). |
| Azimuth 3 Jan 2019 | Dec S22°50.4' (d corr added) | Dec **S22°50.2'** | In January the Sun's south declination is decreasing, so the d correction is subtracted. Azimuth is still N 86.4° E. |
| ETA 5665 NM at 15.8 kn | 358 h 32 min, 22 Mar 1008 | 358 h 32.7 min, 22 Mar **1009** | Seconds dropped. Only a minute. |
| Formula: sin alt = (cos lat cos dec cos LHA) − (sin lat sin dec) | as written | **+** when latitude and declination have the same name, **−** when contrary | Your examples were all N lat and S dec, so the minus was right there. |

## Correct as written

- Azimuth by ABC, 3 Jan 2019: N 86.4° E.
- Amplitude, sunset 9 Apr 1998, 48°04'S 025°44'W: W 11.6° N = 281.6° T.
- Sun sights 8 Oct 2019 at 0517 UT (31.0' T, Zn 166.2°) and 0126 UT (29.9' T, Zn 103.8°).
- Great circle 29°53'S 031°02'E to 31°57'S 115°52'E: 4244.2 NM, initial course 116.5° T, vertex 39°05.4'S 076°00.8'E, 33°18.6'S at 040°E. On WGS84, as ECDIS measures it, the distance is 4255.5 NM.
- Plane sailing 37°01'N 009°00'W to 36°11'N 006°02'W: 109.3° T, 151.4 NM.
- Plane sailing 53°06'S 104°24'E, 237°, 104 NM: 54°02.6'S 101°57.2'E. And 22°32'N 059°48'E, 131°, 413 NM: 18°01.1'N 065°20.3'E (the second attempt).
- Extended run fix: 34°05.8'N 154°27.5'E.
- Gyro error: GE = TB − GCB, gyro high is minus, low is plus.

## Where each page now lives in the app

| Notebook page | App page |
|---|---|
| Azimuth (ABC), amplitude, gyro error | Gyro & Compass Error |
| Variation and deviation | Deviation Card |
| Sun sights, intercept, altitude corrections, run fix | Sight Fix |
| Plane sailing, both ways | Course & Speed Made Good (two cards) |
| ETA with zones | ETA Calculator |
| Great circle | Not in the app: ECDIS does it (owner's decision, 25 Oct 2026) |
