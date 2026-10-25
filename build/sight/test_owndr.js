// The officer's own DR at each sight: the same positions as course and speed give must give the same fix; a different
// track (positions typed by hand) must be followed; the working shows those positions.
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return { S: Sight, F: SightFix };')(), S = M.S, F = M.F;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const R = Math.PI / 180, t0 = Date.UTC(2026, 3, 14, 2, 40, 0), names = ['Fomalhaut', 'Vega', 'Spica', 'Schedar'];
// truth: ship steams 332 at 15 kn, but with a current setting her 090 at 2 kn that the DR does not know
const truthAt = ms => { const h = (ms - t0) / 3600000, a = F.advance(21 + 20 / 60, 38, 332, 15 * h); return F.advance(a.lat, a.lon, 90, 2 * h); };
const sights = names.map((nm, i) => { const ms = t0 + i * 360000, p = truthAt(ms), r = S.reduceBody(S.place(ms, nm), p.lat, p.lon); return { name: nm, ms, ho: r.hc }; });
const dr = { lat: 21 + 20 / 60, lon: 38, ms: t0, course: 332, speed: 15 }, base = { dr, hoe: 0, ic: 0, temp: 10, pres: 1010 };
const a = F.fix(Object.assign({}, base, { sights }));
const b = F.fix(Object.assign({}, base, { sights: sights.map(s => Object.assign({}, s, { dr: F.drAt(dr, s.ms) })) }));
ok(!a.error && !b.error, 'both work');
ok(Math.hypot((a.fix.lat - b.fix.lat) * 60, (a.fix.lon - b.fix.lon) * 60 * Math.cos(a.fix.lat * R)) < 0.01, 'own positions equal to course and speed give the same fix');
// officer types positions that include the current (the true track): the fix must come out on the true position at the last sight
const c = F.fix(Object.assign({}, base, { sights: sights.map(s => Object.assign({}, s, { dr: (() => { const p = truthAt(s.ms); return { lat: p.lat + 0.03, lon: p.lon - 0.03 }; })() })) }));
const tl = truthAt(sights[3].ms), ec = Math.hypot((c.fix.lat - tl.lat) * 60, (c.fix.lon - tl.lon) * 60 * Math.cos(tl.lat * R)), ea = Math.hypot((a.fix.lat - tl.lat) * 60, (a.fix.lon - tl.lon) * 60 * Math.cos(tl.lat * R));
ok(ec < 0.05, 'typed positions following the real track: fix error ' + ec.toFixed(3) + ' NM (course and speed only: ' + ea.toFixed(2) + ' NM)');
ok(c.sights.every((s, i) => Math.abs(s.ap.lat - (truthAt(s.ms).lat + 0.03)) < 1e-9), 'the working uses the typed positions');
console.log(bad ? 'FAILED ' + bad : 'own-DR tests passed: ' + n); process.exit(bad ? 1 : 0);
