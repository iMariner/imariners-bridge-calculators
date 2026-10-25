// Moonrise/moonset against JPL DE440 (de440_moonrise.json from ref_moonrise.py), and the moving-ship rule.
const fs = require('fs'), html = fs.readFileSync(__dirname + '/../../Bridge-Calculators.html', 'utf8');
const eng = fs.readFileSync(__dirname + '/../sight/engine.js', 'utf8'), sun = html.slice(html.indexOf('  /* SUN-BEGIN */'), html.indexOf('/* SUN-END */'));
const ST = new Function(eng + sun + 'return SunTimes;')();
let bad = 0, n = 0, worst = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
JSON.parse(fs.readFileSync(__dirname + '/de440_moonrise.json')).forEach(r => {
  const d = new Date(r.start), R = ST.solve(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, r.lat, r.lon, 0, null);
  const mine = R.moon.rise.map(t => ({ ms: t, rise: true })).concat(R.moon.set.map(t => ({ ms: t, rise: false })));
  r.events.forEach(e => { const m = mine.find(x => x.rise === e.rise && Math.abs(x.ms - e.ms) < 600000); if (!m) { ok(false, 'missing event ' + JSON.stringify(e)); return; } const s = Math.abs(m.ms - e.ms) / 1000; worst = Math.max(worst, s); ok(s < 30, 'moon event off by ' + s.toFixed(1) + ' s'); });
  ok(mine.length === r.events.length, 'same number of moon events ' + mine.length + ' / ' + r.events.length);
});
console.log('moonrise/moonset vs DE440: worst', worst.toFixed(1), 's');
// moving ship: at the found sunrise the Sun's centre is at -(34' + SD) seen from the ship's position at that moment
const mv = { course: 90, speed: 20, ms: Date.UTC(2026, 2, 20, 0, 0, 0) }, R2 = ST.solve(2026, 3, 20, 0, 10, 60, 0, mv), R0 = ST.solve(2026, 3, 20, 0, 10, 60, 0, null);
const tr = R2.levels.sun.rise[0], q = R2.P(tr), a = ST.alt(tr, q.lat, q.lon); ok(Math.abs(a - R2.hSun) < 0.002, 'moving ship: Sun on the horizon at the ship position, ' + ((a - R2.hSun) * 60).toFixed(3) + "'");
const ds = (R0.levels.sun.rise[0] - tr) / 1000; ok(ds > 30 && ds < 300, 'running east at 20 kn the Sun rises earlier than at anchor by ' + ds.toFixed(0) + ' s');
ok(Math.abs(q.lon - (60 + 20 * (tr - mv.ms) / 3600000 / 60 / Math.cos(10 * Math.PI / 180))) < 1e-6, 'ship position on course 090');
console.log(bad ? 'FAILED ' + bad : 'moon and moving-ship tests passed: ' + n); process.exit(bad ? 1 : 0);
