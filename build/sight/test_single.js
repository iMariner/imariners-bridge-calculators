// One sight on its own: longitude by chronometer must put the body exactly at Ho from (DR lat, lonChron),
// and the ITP must lie on the circle of position (to within the straight-line approximation).
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return { Sight: Sight, SightFix: SightFix };')(), Sight = M.Sight, SF = M.SightFix;
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
// synthetic: true position, make Hs from it, DR offset; the chron longitude at the TRUE latitude must return the true longitude
const cases = [[50.2, -8.4, Date.UTC(2026, 5, 10, 7, 30, 0), 'Sun'], [-33.9, 18.4, Date.UTC(2026, 0, 5, 16, 10, 0), 'Sun'], [21.4, 37.95, Date.UTC(2026, 3, 14, 2, 48, 0), 'Fomalhaut'], [10, -179.9, Date.UTC(2026, 10, 20, 20, 0, 0), 'Sun']];
cases.forEach(c => {
  const [lat, lon, ms, name] = c, f = Sight.frame(ms), pl = name === 'Sun' ? Sight.sunPlace(ms, f) : Sight.starPlace(ms, name, f), r = Sight.reduce(lat, lon, pl.gha, pl.dec);
  // Hs that gives Ho = true altitude (invert corrections by iteration)
  const o = { ic: 0, hoe: 15, temp: 10, pres: 1010 }; let hs = r.hc; for (let k = 0; k < 20; k++) { const h = Sight.ho({ hs, ic: 0, hoe: 15, temp: 10, pres: 1010, body: name === 'Sun' ? 'sun' : 'star', limb: 'L', sd: pl.sd, hp: pl.hp }); hs += r.hc - h.ho; }
  const res = SF.single(Object.assign({ dr: { lat: lat, lon: lon + 0.15, ms, course: 0, speed: 0 }, sights: [{ name, ms, hs, limb: 'L' }] }, o));
  ok(!res.error, name + ' no error: ' + res.error);
  if (res.lonChron !== null) { const e = ((res.lonChron - lon + 540) % 360 - 180) * 60 * Math.cos(lat * Math.PI / 180); ok(Math.abs(e) < 0.05, name + ' chron longitude error ' + e.toFixed(3) + ' NM'); }
  else console.log(name, 'no chron longitude (body near meridian), Zn', res.sights[0].zn.toFixed(1));
  const ri = Sight.reduce(res.itp.lat, res.itp.lon, pl.gha, pl.dec); ok(Math.abs((ri.hc - r.hc) * 60) < 0.2, name + ' ITP on the circle, miss ' + ((ri.hc - r.hc) * 60).toFixed(3) + "'");
});
// latitude by Polaris and by an ex-meridian Sun: latChron at the TRUE longitude must give the true latitude
[[35.5, -140.2, Date.UTC(2026, 2, 3, 10, 40, 0), 'Polaris'], [12.3, 60.1, Date.UTC(2026, 6, 1, 8, 20, 0), 'Sun'], [-20.4, 57.5, Date.UTC(2026, 8, 9, 8, 5, 0), 'Sun']].forEach(c => {
  const [lat, lon, ms, name] = c, f = Sight.frame(ms), pl = name === 'Sun' ? Sight.sunPlace(ms, f) : Sight.starPlace(ms, name, f), r = Sight.reduce(lat, lon, pl.gha, pl.dec);
  let hs = r.hc; for (let k = 0; k < 20; k++) { const h = Sight.ho({ hs, ic: 0, hoe: 15, temp: 10, pres: 1010, body: name === 'Sun' ? 'sun' : 'star', limb: 'L', sd: pl.sd, hp: pl.hp }); hs += r.hc - h.ho; }
  const res = SF.single({ dr: { lat: lat + 0.2, lon: lon, ms, course: 0, speed: 0 }, ic: 0, hoe: 15, temp: 10, pres: 1010, sights: [{ name, ms, hs, limb: 'L' }] });
  ok(!res.error && res.latChron !== undefined, name + ' gives a latitude (Zn ' + (res.sights ? res.sights[0].zn.toFixed(1) : '?') + ')');
  if (res.latChron !== undefined) ok(Math.abs(res.latChron - lat) * 60 < 0.05, name + ' latitude error ' + ((res.latChron - lat) * 60).toFixed(3) + "'");
});
console.log(bad ? 'FAILED ' + bad : 'single-sight tests passed: ' + n); process.exit(bad ? 1 : 0);
