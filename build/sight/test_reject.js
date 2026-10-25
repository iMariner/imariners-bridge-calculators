// Sights that cannot be right must give "No fix", not a fix hundreds of miles away (owner's test, 25 Oct 2026).
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const SightFix = new Function(src('engine.js') + src('fix.js') + 'return SightFix;')();
const ut = (h, m, s) => Date.UTC(2026, 3, 14, h, m, s);                   // zone +2: UT = local - 2 h
const base = { dr: { lat: 21 + 22.2 / 60, lon: 37 + 57.2 / 60, ms: ut(2, 48, 0), course: 332, speed: 12.4 }, hoe: 29, ic: 0, temp: 27, pres: 1010 };
const run = (t2, t3) => SightFix.fix(Object.assign({}, base, { sights: [
  { name: 'Fomalhaut', ms: ut(2, 48, 2), hs: 11 + 30.6 / 60 }, { name: 'Spica', ms: t2, hs: 4 + 36.8 / 60 }, { name: 'Schedar', ms: t3, hs: 19 + 4.5 / 60 }] }));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const good = run(ut(2, 48, 33), ut(2, 48, 55)); ok(!good.error, 'the workbook example still fixes: ' + good.error);
const typo = run(ut(2, 54, 10), ut(3, 48, 55)); ok(/No fix/.test(typo.error || ''), 'hour typo is refused'); console.log(typo.error);
const oneoff = run(ut(2, 54, 10), ut(2, 48, 55)); ok(/No fix/.test(oneoff.error || ''), 'six minutes wrong on one star is refused'); console.log(oneoff.error);
// a constant error on every star (index error sign wrong) is not blamed on one star (Opus review)
const Sg = new Function(src('engine.js') + 'return Sight;')(), T0 = ut(2, 48, 0), truth = { lat: 21.4, lon: 37.95 };
const mk = (names, err) => names.map((nm, k) => { const ms = T0 + k * 30000, f = Sg.frame(ms), pl = Sg.starPlace(ms, nm, f), r = Sg.reduce(truth.lat, truth.lon, pl.gha, pl.dec); return { name: nm, ms: ms, ho: r.hc + err / 60 }; });
const cfix = (e, nmax) => SightFix.fix({ dr: { lat: 21.45, lon: 37.9, ms: T0, course: 0, speed: 0 }, hoe: 0, ic: 0, temp: 10, pres: 1010, sights: mk(['Fomalhaut', 'Spica', 'Schedar', 'Antares', 'Altair', 'Vega', 'Arcturus', 'Peacock'].filter(n => { const f = Sg.frame(T0), p = Sg.starPlace(T0, n, f), h = Sg.reduce(truth.lat, truth.lon, p.gha, p.dec).hc; return h > 10 && h < 70; }).slice(0, nmax || 4), e) });
console.log('stars used', mk(['Fomalhaut', 'Spica', 'Schedar', 'Antares', 'Altair', 'Vega', 'Arcturus', 'Peacock'], 0).length);
const c12 = cfix(12); ok(!c12.error && c12.warnings.some(w => /same way/.test(w)) && c12.constErr !== undefined && Math.abs(c12.constErr - 12) < 0.5, '12 minute constant error: fix with a clear warning, constant ' + (c12.constErr || 0).toFixed(1) + ' ' + (c12.error || ''));
const c3 = cfix(12, 3); ok(c3.error ? /index error/.test(c3.error) : true, 'three stars, constant error: refusal mentions the index error');
const c0 = cfix(0); ok(!c0.error && !c0.warnings.some(w => /same way/.test(w)), 'clean stars: no constant-error warning');
console.log(bad ? 'FAILED ' + bad : 'reject tests passed: 6'); process.exit(bad ? 1 : 0);
