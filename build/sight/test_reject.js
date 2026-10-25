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
console.log(bad ? 'FAILED ' + bad : 'reject tests passed: 3'); process.exit(bad ? 1 : 0);
