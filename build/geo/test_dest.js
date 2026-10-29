// WGS84.dest (new position from course and distance on a rhumb line): round trips with WGS84.rhumb, an independent
// step-by-step integration (RK4 with the local radii), the date line, due east/west, poles, and the owner's notebook examples.
const fs = require('fs');
const W = new Function(fs.readFileSync(__dirname + '/wgs84.js', 'utf8') + 'return WGS84;')();
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), R = Math.PI / 180;
const dlon = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
function integ(lat, lon, c, dist) {                        // integrate d(lat)/ds = cos c / M, d(lon)/ds = sin c / (N cos lat)
  const N = 4000, h = dist * 1852 / N, cc = Math.cos(c * R), sc = Math.sin(c * R);
  const fl = p => { const s = Math.sin(p); return cc * Math.pow(1 - e2 * s * s, 1.5) / (a * (1 - e2)); };
  const fo = p => { const s = Math.sin(p); return sc * Math.sqrt(1 - e2 * s * s) / (a * Math.cos(p)); };
  let p = lat * R, o = lon * R;
  for (let i = 0; i < N; i++) {
    const k1 = fl(p), k2 = fl(p + h / 2 * k1), k3 = fl(p + h / 2 * k2), k4 = fl(p + h * k3);
    const j1 = fo(p), j2 = fo(p + h / 2 * k1), j3 = fo(p + h / 2 * k2), j4 = fo(p + h * k3);
    p += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); o += h / 6 * (j1 + 2 * j2 + 2 * j3 + j4);
  }
  return { lat: p / R, lon: ((o / R + 540) % 360) - 180 };
}
// 1. random round trips and integration
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let worst = 0, worstI = 0;
for (let i = 0; i < 400; i++) {
  const lat = -70 + 140 * rnd(), lon = -180 + 360 * rnd(), c = 360 * rnd(), d = 1 + 3000 * rnd();
  const p = W.dest(lat, lon, c, d); if (!p || Math.abs(p.lat) > 80) continue;
  const r = W.rhumb(lat, lon, p.lat, p.lon);
  const ce = Math.abs(((r.course - c + 540) % 360) - 180), de = Math.abs(r.dist - d);
  worst = Math.max(worst, de); ok(ce < 1e-6 && de < 1e-6, 'round trip ' + [lat, lon, c, d].map(x => x.toFixed(3)).join(' ') + ' course err ' + ce + ' dist err ' + de);
  const q = integ(lat, lon, c, d), e = Math.max(Math.abs(q.lat - p.lat) * 60, dlon(q.lon, p.lon) * 60 * Math.cos(p.lat * R));
  worstI = Math.max(worstI, e); ok(e < 0.001, 'vs integration ' + [lat, lon, c, d].map(x => x.toFixed(3)).join(' ') + ' off ' + e.toFixed(5) + "'");
}
// 2. due east / west and near it (no jump), across the date line, a hair off 090
[[10, 170, 90, 1200], [-45, -175, 270, 600], [60, 5, 90, 300], [0, 0, 90, 60]].forEach(c => {
  const p = W.dest(...c), q = integ(...c); ok(Math.abs(p.lat - c[0]) < 1e-9 && dlon(p.lon, q.lon) * 60 < 0.001, 'due E/W ' + c.join(' ') + ' -> ' + p.lat.toFixed(5) + ' ' + p.lon.toFixed(5));
});
const e0 = W.dest(30, 0, 90, 500), e1 = W.dest(30, 0, 90.0001, 500); ok(dlon(e0.lon, e1.lon) * 60 < 0.01, 'no jump near 090');
ok(W.dest(0, 0, 0, 60).lat > 0.99 && W.dest(0, 0, 0, 60).lat < 1.01, 'one degree north is about 60 NM');
// 3. over the pole
ok(W.dest(80, 0, 0, 900) === null, 'running over the pole gives null');
// 4. the owner's notebook (plane sailing by mid-latitude, about 0.1' to 1' from the exact answer on these runs)
function plane(lat, lon, c, d) { const dl = d * Math.cos(c * R) / 60, ml = lat + dl / 2, dep = d * Math.sin(c * R); return { lat: lat + dl, lon: lon + dep / Math.cos(ml * R) / 60 }; }
const dm = (d, m) => d + m / 60;
[ // from, course, distance, notebook answer
  [-dm(53, 6), dm(104, 24), 237, 104, -dm(54, 2.6), dm(101, 57.2), 'notebook (e) 53 06S 104 24E 237 104 NM'],
  [dm(22, 32), dm(59, 48), 131, 413, dm(18, 1.1), dm(65, 20.3), 'notebook 22 32N 059 48E 131 413 NM'],
].forEach(t => {
  const p = W.dest(t[0], t[1], t[2], t[3]), pl = plane(t[0], t[1], t[2], t[3]);
  const e = Math.max(Math.abs(p.lat - t[4]) * 60, dlon(p.lon, t[5]) * 60 * Math.cos(p.lat * R)), ep = Math.max(Math.abs(pl.lat - t[4]) * 60, dlon(pl.lon, t[5]) * 60 * Math.cos(pl.lat * R));
  console.log(t[6] + ': app', p.lat.toFixed(4), p.lon.toFixed(4), '| plane', pl.lat.toFixed(4), pl.lon.toFixed(4), '| notebook off app ' + e.toFixed(2) + "', off plane " + ep.toFixed(2) + "'");
  ok(ep < 0.2, t[6] + ' plane sailing matches the notebook'); ok(e < 3, t[6] + ' exact answer close to the notebook');
});
// the 145 deg example: the notebook used 45 deg (180 - 145 is 35), so its answer is not used as a check
const p145 = W.dest(-dm(1, 48), dm(12, 47), 145, 155); console.log('notebook 01 48S 012 47E 145 155 NM: app', p145.lat.toFixed(4), p145.lon.toFixed(4));
ok(Math.abs(p145.lat + dm(3, 54.9)) * 60 < 1 && Math.abs(p145.lon - dm(14, 16.3)) * 60 < 1, '145 deg example: about 03 55S 014 16E (WGS84 minutes of latitude are 0.995 NM near the equator)');
console.log('worst round trip ' + worst.toExponential(2) + ' NM, worst vs integration ' + worstI.toFixed(5) + "'");
console.log(bad ? 'FAILED ' + bad + ' of ' + n : 'dest tests passed: ' + n); process.exit(bad ? 1 : 0);
