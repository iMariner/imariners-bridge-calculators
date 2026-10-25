// The diagram's geometry, as a navigator plots by hand: for every sight
//  1. the intercept is laid off from the assumed position along the azimuth, towards (+) or away (-), by exactly the intercept;
//  2. the position line is at 90 degrees to the azimuth through that point (the T);
//  3. the solid line is the same line moved by the ship's run to the fix time (within the straight-line approximation);
//  4. the fix lies on every solid line (within the sight's own miss, the residual).
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return { S: Sight, F: SightFix };')(), S = M.S, F = M.F;
const P = new Function('SightFix', src('plot.js') + 'return SightPlot;')(F);
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const R = Math.PI / 180;
function check(label, inp) {
  const r = F.fix(inp); if (r.error) { ok(false, label + ': ' + r.error); return; }
  const G = P.geom(r, inp);
  G.L.forEach((l, i) => {
    const s = l.s; if (s.name === 'Latitude') return;
    const z = s.zn * R, ux = Math.sin(z), uy = Math.cos(z), vx = l.f0.x - l.ap.x, vy = l.f0.y - l.ap.y;
    ok(Math.abs(Math.hypot(vx, vy) - Math.abs(s.a)) < 1e-9, label + ' ' + s.name + ': intercept length');
    ok(Math.abs(vx * uy - vy * ux) < 1e-9 && (vx * ux + vy * uy) * s.a >= 0, label + ' ' + s.name + ': intercept along the azimuth, towards/away right');
    ok(Math.abs(l.dx * ux + l.dy * uy) < 1e-12, label + ' ' + s.name + ': position line at 90 degrees to the azimuth');
    const ds = G.pl(s.drSight || s.ap), run = { x: G.dF.x - ds.x, y: G.dF.y - ds.y };
    const shift = ((l.f1.x - (l.f0.x + run.x)) * ux + (l.f1.y - (l.f0.y + run.y)) * uy);
    ok(Math.abs(shift) < 0.3, label + ' ' + s.name + ': solid line = dashed line moved by the run (' + shift.toFixed(3) + ' NM)');
    const miss = Math.abs(l.f1.x * ux + l.f1.y * uy);
    ok(Math.abs(miss - Math.abs(r.residuals[i])) < 0.01, label + ' ' + s.name + ': fix on the solid line within its residual');
  });
}
// 4 stars 6 minutes apart, ship under way, DR 5 miles out (as in the Sight Fix example)
const t0 = Date.UTC(2026, 0, 15, 11, 58, 0), names = ['Kochab', 'Rasalhague', 'Menkent', 'Regulus'];
const dr = { lat: 22.9, lon: -90.4, ms: t0, course: 60, speed: 14 }, truth = ms => F.move(F.drAt(dr, ms), 3, -4);
const sights = names.map((nm, i) => { const ms = t0 + i * 6 * 60000, q = truth(ms), rr = S.reduceBody(S.place(ms, nm), q.lat, q.lon); return { name: nm, ms, ho: rr.hc + (i - 1.5) * 0.4 / 60 }; });
check('stars, each DR', { dr, hoe: 0, ic: 0, temp: 10, pres: 1010, sights });
check('stars, first DR', { dr, hoe: 0, ic: 0, temp: 10, pres: 1010, sights, apMode: 'first' });
// Sun running fix, 5.5 hours apart
const s1 = Date.UTC(2026, 0, 15, 14, 40, 0), s2 = Date.UTC(2026, 0, 15, 20, 5, 0);
check('Sun running fix', { dr: Object.assign({}, dr, { ms: s1 }), hoe: 0, ic: 0, temp: 10, pres: 1010, sights: [s1, s2].map(ms => { const q = truth(ms), rr = S.reduceBody(S.place(ms, 'Sun'), q.lat, q.lon); return { name: 'Sun', ms, ho: rr.hc }; }) });
console.log(bad ? 'FAILED ' + bad + ' of ' + n : 'diagram geometry tests passed: ' + n); process.exit(bad ? 1 : 0);
