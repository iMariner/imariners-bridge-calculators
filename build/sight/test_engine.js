// Checks of the sight engine that need no Python: catalogue, corrections against the Nautical Almanac tables, Zn quadrants, round trip.
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const { Sight, SunTimes } = new Function(src('../sun/calc.js') + '\n' + src('engine.js') + '\nreturn { SunTimes, Sight };')();
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' got ' + a + ' want ' + b);
// catalogue
const names = Sight.names(); ok(names.length === 58 && new Set(names).size === 58, '58 distinct stars');
// refraction against the Nautical Almanac star correction table (10 C, 1010 hPa), minutes; table values to 0.1'
[[5, 9.9], [10, 5.3], [20, 2.6], [30, 1.7], [45, 1.0], [60, 0.6], [80, 0.2]].forEach(([ha, r]) => near(Sight.ho({ hs: ha, hoe: 0, body: 'star' }).ref, r, 0.12, 'refraction at ' + ha));
// dip table: 10 m 5.6', 20 m 7.9', 30 m 9.6', 40 m 11.1'
[[10, 5.6], [20, 7.9], [30, 9.6], [40, 11.1]].forEach(([h, d]) => near(Sight.ho({ hs: 30, hoe: h, body: 'star' }).dip, d, 0.06, 'dip at ' + h + ' m'));
// temperature and pressure: colder and higher pressure bends more
const rc = Sight.ho({ hs: 10, temp: -10, pres: 1030, body: 'star' }).ref, rs = Sight.ho({ hs: 10, body: 'star' }).ref, rh = Sight.ho({ hs: 10, temp: 35, pres: 990, body: 'star' }).ref;
ok(rc > rs && rs > rh, 'temperature and pressure direction');
// Sun: lower limb adds SD, upper limb subtracts, parallax about 0.15' x cos(alt)
const lo = Sight.ho({ hs: 30, hoe: 0, body: 'sun', limb: 'L', sd: 16, hp: 0.15 }), up = Sight.ho({ hs: 30, hoe: 0, body: 'sun', limb: 'U', sd: 16, hp: 0.15 });
near((lo.ho - up.ho) * 60, 32, 0.001, 'LL minus UL = 2 SD'); near(lo.par, 0.13, 0.005, 'sun parallax at 30 deg');
// index correction sign: ic is added
near((Sight.ho({ hs: 30, ic: 2, body: 'star' }).ho - Sight.ho({ hs: 30, ic: 0, body: 'star' }).ho) * 60, 2, 0.01, 'ic added');
// Zn quadrants near the zenith: lat 10 N, dec 20 N
let a = Sight.reduce(10, 0, 359.5, 20), b = Sight.reduce(10, 0, 0.5, 20);
ok(a.hc > 79 && a.zn > 0 && a.zn < 90, 'LHA 359.5 gives Zn in NE ' + a.zn); ok(b.hc > 79 && b.zn > 270 && b.zn < 360, 'LHA 0.5 gives Zn in NW ' + b.zn);
// southern hemisphere, body south of observer: lat 35 S, dec 60 S, LHA 90 (west) -> Zn between 180 and 270? body is in the west, south
a = Sight.reduce(-35, 0, 90, -60); ok(a.zn > 180 && a.zn < 360, 'west body Zn ' + a.zn);
// dateline: longitude 179.9 E with GHA making LHA wrap
a = Sight.reduce(10, 179.9, 0.3, 5); near(a.lha, 180.2, 1e-9, 'LHA wraps through the dateline');
// the Sun with the existing routine: noon at Greenwich on 21 Jun 2026 is near LHA 0, Dec +23.4
const sp = Sight.sunPlace(Date.UTC(2026, 5, 21, 12, 1, 38)); near(sp.dec, 23.44, 0.05, 'Sun Dec at the solstice'); ok(Math.min(sp.gha, 360 - sp.gha) < 0.5, 'Sun GHA near 0 at noon');
// stars: SHA + GHA Aries consistent between two moments one sidereal day apart
const m1 = Date.UTC(2026, 10, 3, 3, 0, 0), m2 = m1 + 86164.0905 * 1000;
near(((Sight.starPlace(m2, 'Sirius').gha - Sight.starPlace(m1, 'Sirius').gha + 540) % 360) - 180, 0, 0.02, 'a sidereal day returns the star');
// Polaris is within 1.1 degrees of the pole
near(Sight.starPlace(Date.UTC(2026, 9, 26), 'Polaris').dec, 89.35, 0.1, 'Polaris dec');
// suggestion: 4 bright stars 20 to 70 degrees up, azimuths spread (smallest gap at least 40 degrees for a good sky)
{ const ms = Date.UTC(2026, 9, 26, 17, 30, 0), pick = Sight.suggest(ms, 21.37, 37.95, 4); ok(pick.length === 4, 'four stars suggested'); pick.forEach(s => ok(s.hc >= 20 && s.hc <= 70 && Sight.mag(s.name) <= 2.3, 'suggested star usable ' + s.name)); const z = pick.map(s => s.zn).sort((a, b) => a - b); let gap = 360; z.forEach((v, i) => { gap = Math.min(gap, (i + 1 < z.length ? z[i + 1] : z[0] + 360) - v); }); ok(gap > 40, 'spread ' + gap.toFixed(0)); }
console.log('engine tests passed: ' + n);
