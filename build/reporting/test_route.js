// Route maths for Ship Reporting: positions along rhumb legs, boundary crossings, circles. Checked against WGS84.rhumb and brute-force sampling.
const fs = require('fs'), path = require('path');
const W = fs.readFileSync(path.join(__dirname, '../geo/wgs84.js'), 'utf8'), Rt = fs.readFileSync(path.join(__dirname, 'route.js'), 'utf8');
const { WGS84, SRoute } = new Function(W + Rt + 'return { WGS84, SRoute };')();
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

// 1. points along a leg lie on the rhumb line, at the right distance
for (let t = 0; t < 400; t++) {
  const a = { lat: rnd() * 140 - 70, lon: rnd() * 360 - 180 }, b = { lat: Math.max(-75, Math.min(75, a.lat + rnd() * 20 - 10)), lon: a.lon + rnd() * 30 - 15 };
  const P = SRoute.plan([a, b], 0, 12); if (P.total < 1) continue;
  const d = rnd() * P.total, q = SRoute.atDist(P, d), r = WGS84.rhumb(a.lat, a.lon, q.lat, q.lon);
  ok(Math.abs(r.dist - d) < 1e-6 * Math.max(1, d) + 1e-6, 'distance along leg ' + r.dist + ' vs ' + d);
  if (d > 1) ok(Math.abs(((r.course - P.legs[0].course + 540) % 360) - 180) < 1e-5, 'course along leg ' + r.course + ' vs ' + P.legs[0].course);
}
// 2. crossings agree with brute force (inside() sampled every 0.05 NM, then bisection)
function brute(P, G) {
  const ev = [], step = 0.05; let prev = SRoute.inside(G, P.pts[0].lat, P.pts[0].lon);
  for (let d = step; d <= P.total + step / 2; d += step) {
    const dd = Math.min(d, P.total), q = SRoute.atDist(P, dd), now = SRoute.inside(G, q.lat, q.lon);
    if (now !== prev) { let lo = dd - step, hi = dd; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, p = SRoute.atDist(P, m); if (SRoute.inside(G, p.lat, p.lon) === prev) lo = m; else hi = m; } ev.push({ d: (lo + hi) / 2, kind: now ? 'entry' : 'exit' }); prev = now; }
  }
  return ev;
}
let cases = 0;
for (let t = 0; t < 120; t++) {
  const c = { lat: rnd() * 120 - 60, lon: rnd() * 340 - 170 }, k = 0.5 + rnd() * 1.5, ring = [];
  const nv = 3 + Math.floor(rnd() * 7);
  for (let i = 0; i < nv; i++) { const ang = i / nv * 2 * Math.PI, rr = k * (0.5 + rnd() * 0.5); ring.push(c.lon + rr * Math.cos(ang) * 1.3, c.lat + rr * Math.sin(ang)); }
  const G = SRoute.prep([ring]);
  const wp = []; let p = { lat: c.lat - 2.5 + rnd() * 1.5, lon: c.lon - 3 + rnd() * 1.5 };
  for (let i = 0; i < 4; i++) { wp.push(p); p = { lat: c.lat - 2 + rnd() * 4, lon: p.lon + 1 + rnd() * 1.6 }; }
  const P = SRoute.plan(wp, 0, 12), X = SRoute.cross(P, G).events, B = brute(P, G);
  if (!B.length && !X.length) continue; cases++;
  ok(X.length === B.length, 'number of crossings ' + X.length + ' vs brute ' + B.length + ' case ' + t);
  for (let i = 0; i < Math.min(X.length, B.length); i++) { ok(Math.abs(X[i].d - B[i].d) < 0.06, 'crossing distance ' + X[i].d.toFixed(3) + ' vs ' + B[i].d.toFixed(3)); ok(X[i].kind === B[i].kind, 'crossing kind'); }
}
ok(cases > 60, 'enough crossing cases: ' + cases);
// 3. a crossing on a parallel boundary (like 'north of 48 N') is at that latitude exactly
{
  const G = SRoute.prep([[-10, 48, 0, 48, 0, 52, -10, 52]]), P = SRoute.plan([{ lat: 46, lon: -8 }, { lat: 50, lon: -2 }], Date.UTC(2026, 0, 1), 10), X = SRoute.cross(P, G);
  ok(X.events.length === 1 && X.events[0].kind === 'entry' && Math.abs(X.events[0].lat - 48) < 1e-9, 'entry on 48N at ' + (X.events[0] && X.events[0].lat));
  const r = WGS84.rhumb(46, -8, 48, X.events[0].lon); ok(Math.abs(r.dist - X.events[0].d) < 1e-6, 'distance to the 48N crossing');
  ok(Math.abs(((r.course - P.legs[0].course + 540) % 360) - 180) < 1e-6, 'crossing lies on the leg');
  ok(SRoute.timeAt(P, 10) === Date.UTC(2026, 0, 1) + 3600000, 'time at 10 NM at 10 kn is one hour');
}
// 4. across the date line: route 179E -> 179W through a box 179.5E..179.5W
{
  const G = SRoute.prep([[179.5, 50, 180, 50, 180, 52, 179.5, 52], [-180, 50, -179.5, 50, -179.5, 52, -180, 52]]);
  const P = SRoute.plan([{ lat: 51, lon: 179 }, { lat: 51, lon: -179 }], 0, 10), X = SRoute.cross(P, G).events;
  ok(X.length === 2 && X[0].kind === 'entry' && X[1].kind === 'exit', 'date line: one entry, one exit (got ' + X.length + ')');
  ok(Math.abs(X[0].lon - 179.5) < 1e-9 && Math.abs(X[1].lon + 179.5) < 1e-9, 'date line crossing longitudes');
}
// 5. circles: every vertex at the radius (rhumb lines from the centre; geodesic distance within 0.05 %)
for (let t = 0; t < 50; t++) {
  const la = rnd() * 140 - 70, lo = rnd() * 360 - 180, r = 1 + rnd() * 60, ring = SRoute.circle(la, lo, r);
  let worst = 0; for (let i = 0; i < ring.length; i += 2) worst = Math.max(worst, Math.abs(WGS84.geodesic(la, lo, ring[i + 1], ring[i]).dist - r) / r);
  ok(worst < 5e-4, 'circle radius error ' + (worst * 100).toFixed(4) + '%');
  ok(SRoute.inside(SRoute.prep([ring]), la, lo), 'centre inside its circle');
}
// 6. inverse isometric latitude
for (let la = -85; la <= 85; la += 5) ok(Math.abs(SRoute.invIso(SRoute.iso(la)) - la) < 1e-10, 'invIso ' + la);
console.log((bad ? 'FAILED ' + bad + ' of ' : 'route tests passed: ') + n + ' checks');
process.exit(bad ? 1 : 0);
