// The owner's workbook example (CEL NAV.xls, sheet Stars), reproduced with the JS engine.
// DR 21 22.2 N 037 57.2 E, 14 April 2026, 04:48:00 zone time (zone -2 => UT 02:48:00), height of eye 29 m, temp 27 C, pressure 1010.
// Workbook results (all three stars worked from the fix-time DR): Hc 11 13.92, 4 20.07, 18 48.08; Zn 128.1, 256.1, 35.4; Ho 11 15.2, 4 21.4, 18 49.1.
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const { Sight } = new Function(src('../sun/calc.js') + '\n' + src('engine.js') + '\nreturn { SunTimes, Sight };')();
const lat = 21 + 22.2 / 60, lon = 37 + 57.2 / 60, t0 = Date.UTC(2026, 3, 14, 2, 48, 0);
const rows = [['Fomalhaut', 0, 11 + 30.6 / 60, 11 + 13.92175 / 60, 128.1, 11 + 15.2 / 60], ['Spica', 33 * 86400 / 86440, 4 + 36.8 / 60, 4 + 20.07345 / 60, 256.1, 4 + 21.4 / 60], ['Schedar', 55 * 86400 / 86440, 19 + 4.5 / 60, 18 + 48.08354 / 60, 35.4, 18 + 49.1 / 60]];
let worst = 0;
rows.forEach(r => {
  const ms = t0 + r[1] * 1000, p = Sight.starPlace(ms, r[0]), x = Sight.reduce(lat, lon, p.gha, p.dec), h = Sight.ho({ hs: r[2], ic: 0, hoe: 29, temp: 27, pres: 1010, body: 'star' });
  const dHc = (x.hc - r[3]) * 60, dZn = x.zn - r[4], dHo = (h.ho - r[5]) * 60;
  worst = Math.max(worst, Math.abs(dHc), Math.abs(dHo));
  console.log(r[0].padEnd(10), 'Hc diff ' + dHc.toFixed(2) + "'", ' Zn ' + x.zn.toFixed(1) + ' (workbook ' + r[4] + ')', ' Ho ' + (h.ho * 60 / 60).toFixed(4) + ' diff ' + dHo.toFixed(2) + "'", ' [dip ' + h.dip.toFixed(2) + ' ref ' + h.ref.toFixed(2) + ']');
});
const assert = require('assert');
// The calculated altitudes and azimuths must agree with the workbook (it works from a 1975 catalogue, so a few tenths of a minute).
rows.forEach(r => { const p = Sight.starPlace(t0 + r[1] * 1000, r[0]), x = Sight.reduce(lat, lon, p.gha, p.dec); assert(Math.abs((x.hc - r[3]) * 60) < 0.25, r[0] + ' Hc'); assert(Math.abs(x.zn - r[4]) < 0.15, r[0] + ' Zn'); });
// The workbook refraction is too big: it uses a constant for pressure in mmHg but is fed millibars (about 4/3 too much). Ours matches the Almanac tables.
const wbRef = [5.9, 12.7, 3.5];
rows.forEach((r, i) => { const h = Sight.ho({ hs: r[2], ic: 0, hoe: 29, temp: 27, pres: 1010, body: 'star' }); const ratio = wbRef[i] / h.ref; assert(ratio > 1.15 && ratio < 1.4, r[0] + ' workbook refraction ratio ' + ratio.toFixed(2)); });
console.log("workbook Hc and Zn agree; its refraction is 1.2 to 1.3 times ours (pressure unit bug), so its Ho differ by up to " + worst.toFixed(1) + "'");
