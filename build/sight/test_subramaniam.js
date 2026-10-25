// Capt. H. Subramaniam, Practical Navigation (Nutshell Series Book 1, 2010), chapter 26 "Noon position by the Sun", worked example
// (29 Nov 1992, 1992 Nautical Almanac). Morning Sun worked as longitude by chronometer, then the meridian altitude: noon position.
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return { S: Sight, F: SightFix };')(), S = M.S, F = M.F;
let bad = 0, n = 0; const near = (a, b, tol, m) => { n++; const d = (a - b) * 60; if (Math.abs(d) > tol) { bad++; console.log('FAIL', m, d.toFixed(2)); } else console.log(m.padEnd(42), 'diff', d.toFixed(2) + "'"); };
const gmt = (h, m, s) => Date.UTC(1992, 10, 29, h, m, s), base = { hoe: 10, ic: 2.3, temp: 10, pres: 1010, anyYear: true };
const dr = { lat: 26 + 27 / 60, lon: -(130 + 29 / 60), ms: gmt(17, 48, 8), course: 157, speed: 12 };
[[[17, 47, 49], 27 + 40 / 60, 130 + 30.6 / 60], [[17, 48, 8], 27 + 43 / 60, 130 + 30.4 / 60], [[17, 48, 28], 27 + 46 / 60, 130 + 30.5 / 60]].forEach((o, i) => {
  const ms = gmt.apply(null, o[0]), r = F.single(Object.assign({}, base, { dr: Object.assign({}, dr, { ms }), sights: [{ name: 'Sun', ms, hs: o[1], limb: 'L' }] }));
  near(-r.lonChron, o[2], 0.5, 'morning sight ' + (i + 1) + ': longitude by chronometer');
  if (i === 0) near(r.sights[0].zn, 136.7, 0.3 * 60, 'morning sight azimuth');
});
[[42 + 15.1 / 60, 25 + 49.8 / 60, 130 + 16.1 / 60], [42 + 10.4 / 60, 25 + 54.5 / 60, 130 + 10.4 / 60]].forEach((sc, i) => {
  const r = F.fix(Object.assign({}, base, { dr, fixMs: gmt(21, 0, 0), sights: [{ name: 'Sun', ms: gmt(17, 48, 8), hs: 27 + 43 / 60, limb: 'L' }, { name: 'Sun', ms: gmt(20, 28, 55), hs: sc[0], limb: 'L' }] }));
  near(r.fix.lat, sc[1], 0.5, 'scenario ' + (i + 1) + ': noon latitude'); near(-r.fix.lon, sc[2], 0.5, 'scenario ' + (i + 1) + ': noon longitude');
});
const p = S.sunPlace(gmt(20, 28, 55)); let ho = 90 - Math.abs(25 + 57.4 / 60 - p.dec), hs = ho;
for (let k = 0; k < 8; k++) { const c = S.ho({ hs, ic: 2.3, hoe: 10, body: 'sun', limb: 'L', sd: p.sd, hp: p.hp }); hs += ho - c.ho; }
near(hs, 42 + 13.2 / 60, 0.3, 'sextant meridian altitude to preset');
console.log(bad ? 'FAILED ' + bad : 'Subramaniam ch. 26 tests passed: ' + n); process.exit(bad ? 1 : 0);
