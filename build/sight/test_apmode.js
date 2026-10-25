// Working every sight from the first DR (book example 9) or from the DR carried forward (example 10) must give the same fix;
// only the intercepts in the working change, and each one must equal Ho - Hc worked from its own assumed position.
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return { S: Sight, F: SightFix };')(), S = M.S, F = M.F;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const day = Date.UTC(2021, 4, 6), loc = (h, m, s) => day + (h * 3600 + m * 60 + s + 5 * 3600) * 1000;
const base = { dr: { lat: 22 + 54.6 / 60, lon: -(94 + 25.3 / 60), ms: loc(13, 48, 55), course: 332, speed: 12.4 }, hoe: 29, ic: 0, temp: 27, pres: 1010,
  sights: [{ name: 'Sun', ms: loc(13, 48, 55), hs: 79 + 41 / 60, limb: 'L' }, { name: 'Sun', ms: loc(17, 6, 55), hs: 35 + 15 / 60, limb: 'L' }] };
const a = F.fix(base), b = F.fix(Object.assign({}, base, { apMode: 'first' }));
ok(!a.error && !b.error, 'both work');
const d = Math.hypot((a.fix.lat - b.fix.lat) * 60, (a.fix.lon - b.fix.lon) * 60 * Math.cos(a.fix.lat * Math.PI / 180)); ok(d < 1e-9, 'same fix either way (' + d.toExponential(1) + ' NM)');
ok(b.sights[1].ap.lat === base.dr.lat && b.sights[1].ap.lon === base.dr.lon, 'second sight worked from the first DR');
b.sights.concat(a.sights).forEach(s => { const r = S.reduce(s.ap.lat, s.ap.lon, s.gha, s.dec); ok(Math.abs((s.ho - r.hc) * 60 - s.a) < 1e-9 && Math.abs(r.zn - s.zn) < 1e-9, 'intercept = Ho - Hc from its assumed position'); });
console.log('second sight intercept: DR carried forward', a.sights[1].a.toFixed(1), "' | first DR", b.sights[1].a.toFixed(1), "' (run " + (12.4 * (loc(17, 6, 55) - loc(13, 48, 55)) / 3600000).toFixed(1) + ' NM)');
console.log(bad ? 'FAILED ' + bad : 'assumed-position tests passed: ' + n); process.exit(bad ? 1 : 0);
