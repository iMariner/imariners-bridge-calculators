// The owner's old notebook pages (checked 29-30 Oct 2026, then thrown away): every worked example, with the CORRECTED answers,
// against the app's engines. Corrections are listed in docs/notebook-check.md.  usage: node build/tools/test_notebook.js
const fs = require('fs'), B = __dirname + '/../';
const { Sight } = new Function(fs.readFileSync(B + 'sun/calc.js', 'utf8') + '\n' + fs.readFileSync(B + 'sight/engine.js', 'utf8') + '\nreturn { SunTimes, Sight };')();
const W = new Function(fs.readFileSync(B + 'geo/wgs84.js', 'utf8') + 'return WGS84;')();
const R = Math.PI / 180, dm = (d, m) => d + m / 60, ut = (y, mo, d, h, mi, s) => Date.UTC(y, mo - 1, d, h, mi, s);
let n = 0, bad = 0; const near = (a, b, tol, m) => { n++; if (!(Math.abs(a - b) <= tol)) { bad++; console.log('FAIL ' + m + ': got ' + a.toFixed(3) + ' want ' + b); } };
function sun(ms, lat, lon, hs, dip) {                     // Sun lower limb, height of eye from the notebook's dip
  const p = Sight.sunPlace(ms), r = Sight.reduce(lat, lon, p.gha, p.dec), o = Sight.ho({ hs: hs, hoe: Math.pow(dip / 1.76, 2), body: 'sun', limb: 'L', sd: p.sd, hp: p.hp });
  return { p: p, zn: r.zn, hc: r.hc, ho: o.ho, a: (o.ho - r.hc) * 60 };
}
// Azimuth by ABC, 3 Jan 2019 0727:26 UT, 28 53S 035 49E: N 86.4 E. Dec S 22 50.2 (the d correction is subtracted: dec decreasing)
let s = sun(ut(2019, 1, 3, 7, 27, 26), -dm(28, 53), dm(35, 49), 30, 9.6);
near(s.zn, 86.41, 0.05, 'azimuth 3 Jan 2019'); near(s.p.dec, -dm(22, 50.2), 0.1 / 60 + 1e-9, 'declination 3 Jan 2019');
// Amplitude, sunset 9 Apr 1998 48 04S 025 44W, 1917 UT: W 11.6 N = 281.6
const p = Sight.sunPlace(ut(1998, 4, 9, 19, 17, 0)); near(270 + Math.asin(Math.sin(p.dec * R) / Math.cos(dm(48, 4) * R)) / R, 281.6, 0.05, 'amplitude 9 Apr 1998');
// Intercepts (Sun LL, IE 0)
s = sun(ut(2019, 10, 9, 1, 1, 10), dm(13, 3), dm(94, 7.9), dm(20, 13.6), 9.6);   // notebook added the dip: 15.9 T is wrong, 3.4 A is right
near(s.zn, 101.7, 0.05, '9 Oct 2019 Zn'); near(s.hc, dm(20, 21.0), 0.25 / 60, '9 Oct 2019 Hc'); near(s.a, -3.4, 0.15, '9 Oct 2019 intercept (away)');
s = sun(ut(2019, 10, 8, 5, 17, 30), dm(15, 36.2), dm(92, 25), dm(68, 26.8), 9.4);
near(s.zn, 166.2, 0.05, '8 Oct 0517 Zn'); near(s.a, 31.0, 0.15, '8 Oct 0517 intercept');
s = sun(ut(2019, 10, 8, 1, 26, 30), dm(16, 1.9), dm(92, 0.6), dm(24, 8.6), 9.4);
near(s.zn, 103.8, 0.05, '8 Oct 0126 Zn'); near(s.a, 29.9, 0.15, '8 Oct 0126 intercept');
// Great circle 29 53S 031 02E to 31 57S 115 52E (sphere): 4244.2 NM, 116.5, vertex 39 05.4S 076 00.8E, 33 18.6S at 040E
{ const l1 = -dm(29, 53) * R, l2 = -dm(31, 57) * R, dl = (dm(115, 52) - dm(31, 2)) * R;
  const d = Math.acos(Math.sin(l1) * Math.sin(l2) + Math.cos(l1) * Math.cos(l2) * Math.cos(dl)) / R * 60;
  const c = Math.atan2(Math.sin(dl) * Math.cos(l2), Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dl)) / R;
  const lv = Math.acos(Math.abs(Math.sin(c * R) * Math.cos(l1))) / R, lonV = dm(31, 2) + Math.abs(Math.atan(1 / (Math.tan(c * R) * Math.sin(Math.abs(l1)))) / R);
  near(d, 4244.2, 0.1, 'GC distance'); near((c + 360) % 360, 116.47, 0.02, 'GC initial course'); near(lv, dm(39, 5.4), 0.1 / 60, 'GC vertex lat'); near(lonV, dm(76, 0.8), 0.1 / 60, 'GC vertex long');
  near(Math.atan(Math.cos((lonV - 40) * R) * Math.tan(lv * R)) / R, dm(33, 18.6), 0.1 / 60, 'GC lat at 040E');
  near(W.geodesic(-dm(29, 53), dm(31, 2), -dm(31, 57), dm(115, 52)).course, 116.5, 0.1, 'GC initial course on WGS84'); }
// Plane sailing, two positions (mid-latitude as by hand, and the app's exact rhumb within 0.5 NM / 0.2 deg)
[[dm(37, 1), -9, dm(36, 11), -dm(6, 2), 109.3, 151.4], [-dm(18, 2), dm(178, 20), -dm(20, 19), -dm(175, 25), 111.1, 379.8]].forEach(t => {   // notebook 382.3: course rounded to 69 first
  const dLat = (t[2] - t[0]) * 60, dl = ((t[3] - t[1] + 540) % 360 - 180) * 60, dep = dl * Math.cos((t[0] + t[2]) / 2 * R), c = (Math.atan2(dep, dLat) / R + 360) % 360, r = W.rhumb(t[0], t[1], t[2], t[3]);
  near(c, t[4], 0.05, 'plane sailing course ' + t[4]); near(Math.hypot(dLat, dep), t[5], 0.1, 'plane sailing distance ' + t[5]);
  near(r.course, t[4], 0.2, 'exact course ' + t[4]); near(r.dist, t[5], 0.6, 'exact distance ' + t[5]); });
// Plane sailing, course and distance (WGS84 rhumb; the notebook's hand answers are within 1.1')
[[-dm(53, 6), dm(104, 24), 237, 104, -dm(54, 2.6), dm(101, 57.2)], [dm(22, 32), dm(59, 48), 131, 413, dm(18, 1.1), dm(65, 20.3)],
 [-dm(1, 48), dm(12, 47), 145, 155, -dm(3, 55.0), dm(14, 16.0)]].forEach(t => {     // the last: notebook used S45E, it is S35E
  const q = W.dest(t[0], t[1], t[2], t[3]); near(q.lat, t[4], 1.1 / 60, 'DR lat ' + t[2]); near(q.lon, t[5], 1.1 / 60, 'DR long ' + t[2]); });
// Extended run fix: AP 34 09.7N 154 35.6E, Zn 104 5.6 A, Zn 191 5.1 T -> 34 05.8N 154 27.5E
{ const u1 = [Math.sin(104 * R), Math.cos(104 * R)], u2 = [Math.sin(191 * R), Math.cos(191 * R)], det = u1[0] * u2[1] - u1[1] * u2[0];
  const x = (-5.6 * u2[1] - u1[1] * 5.1) / det, y = (u1[0] * 5.1 + 5.6 * u2[0]) / det, lat = dm(34, 9.7) + y / 60;
  near(lat, dm(34, 5.8), 0.1 / 60, 'run fix lat'); near(dm(154, 35.6) + x / 60 / Math.cos((lat + dm(34, 9.7)) / 2 * R), dm(154, 27.5), 0.1 / 60, 'run fix long'); }
// ETA: 5665 NM at 15.8 kn from 0206 UTC 7 Mar, arrival zone +9:30 -> 358 h 32.7 min, 22 Mar 1008.7 (1009 rounded)
{ const h = 5665 / 15.8, arr = ut(2026, 3, 7, 2, 6, 0) + h * 3600e3 + 9.5 * 3600e3; near(h, 358 + 32.7 / 60, 0.1 / 60, 'passage time'); near(arr, ut(2026, 3, 22, 10, 8, 40), 30e3, 'ETA local'); }
console.log(bad ? 'NOTEBOOK FAILED ' + bad + ' of ' + n : 'notebook examples passed: ' + n); process.exit(bad ? 1 : 0);
