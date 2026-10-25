// WGS84 rhumb line and geodesic: Vincenty's own published example, a numerical integration of the rhumb line, continuity near 090/270.
const fs = require('fs'), html = fs.readFileSync(__dirname + '/../../Bridge-Calculators.html', 'utf8');
const W = new Function(fs.readFileSync(__dirname + '/wgs84.js', 'utf8') + 'return WGS84;')();
const blk = html.slice(html.indexOf('  /* WGS84-BEGIN'), html.indexOf('/* COURSE-END */')), cmg = new Function(blk + 'return courseMadeGood;')();
// the old Norie formula (Clarke 1880 meridional parts), kept here only as an independent check of the course
const mpN = l => 7915.7 * Math.log10(Math.tan(Math.PI / 180 * (45 + l / 2))) - 23.3 * Math.sin(l * Math.PI / 180);
const old = (a1, o1, a2, o2) => { let dl = ((o2 - o1 + 540) % 360 - 180) * 60, c = Math.atan2(dl, mpN(a2) - mpN(a1)) * 180 / Math.PI; return { course: (c + 360) % 360, dist: Math.abs((a2 - a1) * 60 / Math.cos(c * Math.PI / 180)) }; };
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
// 1. Vincenty (1975) test: Flinders Peak to Buninyong, 54972.271 m, azimuth 306 52 05.37 (on WGS84 the published GeographicLib value is 54972.271 m)
const g = W.geodesic(-(37 + 57 / 60 + 3.72030 / 3600), 144 + 25 / 60 + 29.52440 / 3600, -(37 + 39 / 60 + 10.15610 / 3600), 143 + 55 / 60 + 35.38390 / 3600);
ok(Math.abs(g.dist * 1852 - 54972.271) < 0.01, 'Vincenty example distance ' + (g.dist * 1852).toFixed(3) + ' m'); ok(Math.abs(g.course - (306 + 52 / 60 + 5.37 / 3600)) < 0.5 / 3600, 'Vincenty example azimuth');
// 2. rhumb distance against a numerical integration with local radii (independent of the series)
const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), R = Math.PI / 180;
function integ(lat1, lon1, lat2, lon2) { const r = W.rhumb(lat1, lon1, lat2, lon2), c = r.course * R, N = 200000; let s = 0;
  // step in latitude when possible, else along the parallel
  if (Math.abs(lat2 - lat1) > 1e-6) { const h = (lat2 - lat1) / N; for (let i = 0; i < N; i++) { const p = (lat1 + (i + 0.5) * h) * R, M = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(p) ** 2, 1.5); s += Math.abs(M * h * R / Math.cos(c)); } }
  else { const p = lat1 * R, Nn = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2); s = Math.abs(((lon2 - lon1 + 540) % 360 - 180) * R) * Nn * Math.cos(p); }
  return s / 1852; }
[[41.3952, 148.747, 41.3858, 148.992], [32.25, -120, 25, 121], [1, 103.8, 51, -1], [-33.9, 18.4, 40.7, -74], [10, -60, 10, -10], [60, 5, 60.0001, 25]].forEach(c => {
  const r = W.rhumb(...c), x = integ(...c); ok(Math.abs(r.dist - x) < 0.01, 'rhumb vs integration ' + c.join(',') + ': ' + r.dist.toFixed(3) + ' vs ' + x.toFixed(3)); });
// 3. continuity: a hair north of due east must not jump
const e0 = W.rhumb(10, -60, 10, -10).dist, e1 = W.rhumb(10, -60, 10 + 0.1 / 60, -10).dist; ok(Math.abs(e1 - e0) < 0.05, 'no jump near 090: ' + e0.toFixed(2) + ' / ' + e1.toFixed(2));
// 4. course agrees with Norie meridional parts (the old function) to 0.05 degree; geodesic <= rhumb
[[41.3952, 148.747, 41.3858, 148.992], [32.25, -120, 25, 121], [1, 103.8, 51, -1]].forEach(c => { const o = old(c[0], c[1], c[2], c[3], null), r = W.rhumb(...c); ok(Math.abs(((o.course - r.course + 540) % 360) - 180) < 0.05, 'course vs Norie MP ' + o.course.toFixed(3) + ' / ' + r.course.toFixed(3)); ok(W.geodesic(...c).dist <= r.dist + 1e-9, 'geodesic not longer than rhumb'); });
[[32.25, -120, 25, 121], [10, -60, 10, -10], [41.3952, 148.747, 41.3858, 148.992]].forEach(c => { const r = cmg(c[0], c[1], c[2], c[3], null), w = W.rhumb(...c); ok(Math.abs(r.course - w.course) < 1e-6 && Math.abs(r.dist - w.dist) < 1e-9, 'app courseMadeGood uses WGS84'); });
const ex = W.rhumb(41 + 23.71 / 60, 148 + 44.82 / 60, 41 + 23.15 / 60, 148 + 59.52 / 60), exo = old(41 + 23.71 / 60, 148 + 44.82 / 60, 41 + 23.15 / 60, 148 + 59.52 / 60, 1);
console.log('Course & Speed example: WGS84', ex.course.toFixed(2), ex.dist.toFixed(3), '| old', exo.course.toFixed(2), exo.dist.toFixed(3));
console.log(bad ? 'FAILED ' + bad : 'wgs84 tests passed: ' + n); process.exit(bad ? 1 : 0);
