// Fixes with the Moon and planets. The Moon's observed altitude comes from JPL DE440 (topo.json from ref_topo.py),
// so this checks the whole chain (Moon place, topocentric reduction, solver) against an independent source.
// usage: node test_moon_planets.js topo.json
const fs = require('fs'), src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return { Sight: Sight, SightFix: SightFix };')(), S = M.Sight, SF = M.SightFix;
const ref = JSON.parse(fs.readFileSync(process.argv[2])); let bad = 0, n = 0, worst = 0, used = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const R = Math.PI / 180, others = ['Venus', 'Jupiter', 'Saturn', 'Mars', 'Sirius', 'Vega', 'Arcturus', 'Canopus', 'Antares', 'Capella', 'Achernar', 'Altair', 'Rigil Kentaurus', 'Deneb', 'Fomalhaut'];
ref.forEach(r => {
  const fr = S.frame(r.ms), up = others.map(nm => { const p = S.place(r.ms, nm, fr), h = S.reduceBody(p, r.lat, r.lon); return { nm, h }; }).filter(o => o.h.hc > 15 && o.h.hc < 70);
  if (up.length < 2) return;
  const moonZ = r.zn; let best = null;                                                   // two bodies that cross the Moon's line well
  for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) { const z = [moonZ, up[i].h.zn, up[j].h.zn].sort((a, b) => a - b), g = Math.min(z[1] - z[0], z[2] - z[1], 360 - z[2] + z[0]); if (!best || g > best.g) best = { g, a: up[i], b: up[j] }; }
  if (best.g < 40) return;
  const sights = [{ name: 'Moon', ms: r.ms, ho: r.hc }, { name: best.a.nm, ms: r.ms, ho: best.a.h.hc }, { name: best.b.nm, ms: r.ms, ho: best.b.h.hc }];
  const res = SF.fix({ dr: { lat: r.lat + 0.12, lon: r.lon - 0.15, ms: r.ms, course: 0, speed: 0 }, hoe: 0, ic: 0, temp: 10, pres: 1010, sights });
  if (res.error) { ok(false, 'fix error ' + res.error); return; }
  const e = Math.hypot((res.fix.lat - r.lat) * 60, ((res.fix.lon - r.lon + 540) % 360 - 180) * 60 * Math.cos(r.lat * R)); worst = Math.max(worst, e); used++;
  ok(e < 0.3, 'Moon + ' + best.a.nm + ' + ' + best.b.nm + ' fix error ' + e.toFixed(3) + ' NM');
});
console.log('Moon fixes against DE440:', used, 'cases, worst position error', worst.toFixed(3), 'NM');
// Hs to Ho for the Moon: lower and upper limb differ by two semi-diameters, and the Moon has no parallax term (it is in Hc)
const ms = Date.UTC(2026, 4, 3, 21, 0, 0), pm = S.place(ms, 'Moon'), rt = S.reduceBody(pm, 30, -40);
const lo = S.ho({ hs: 40, ic: 0, hoe: 10, body: 'moon', limb: 'L', sd: rt.sd }), up = S.ho({ hs: 40, ic: 0, hoe: 10, body: 'moon', limb: 'U', sd: rt.sd });
ok(Math.abs((lo.ho - up.ho) * 60 - 2 * rt.sd) < 1e-9 && lo.par === 0 && rt.sd > 14 && rt.sd < 17, 'Moon limbs and semi-diameter ' + rt.sd.toFixed(2));
// planets: parallax HP cos Ha, no semi-diameter
const pv = S.place(ms, 'Venus'), hv = S.ho({ hs: 20, ic: 0, hoe: 0, body: 'planet', hp: pv.hp }); ok(hv.sd === 0 && Math.abs(hv.par - pv.hp * Math.cos(hv.ha * R)) < 1e-12, 'Venus parallax ' + hv.par.toFixed(2));
// one Moon sight on its own: longitude by chronometer at the true latitude gives the true longitude
const rr = ref.find(x => x.hc > 20 && Math.abs(Math.sin(x.zn * R)) > 0.7), sg = SF.single({ dr: { lat: rr.lat, lon: rr.lon + 0.2, ms: rr.ms, course: 0, speed: 0 }, hoe: 0, ic: 0, temp: 10, pres: 1010, sights: [{ name: 'Moon', ms: rr.ms, hs: 0 }] });
const hsFor = (() => { let hs = rr.hc; const pl = S.place(rr.ms, 'Moon'); for (let k = 0; k < 30; k++) { const sd = S.reduceBody(pl, rr.lat, rr.lon + 0.2).sd, h = S.ho({ hs, ic: 0, hoe: 0, temp: 10, pres: 1010, body: 'moon', limb: 'L', sd }); hs += rr.hc - h.ho; } return hs; })();
const s1 = SF.single({ dr: { lat: rr.lat, lon: rr.lon + 0.2, ms: rr.ms, course: 0, speed: 0 }, hoe: 0, ic: 0, temp: 10, pres: 1010, sights: [{ name: 'Moon', ms: rr.ms, hs: hsFor, limb: 'L' }] });
const el = ((s1.lonChron - rr.lon + 540) % 360 - 180) * 60 * Math.cos(rr.lat * R); ok(Math.abs(el) < 0.4, 'Moon longitude by chronometer vs DE440: ' + el.toFixed(3) + ' NM');
// Codex case: the chronometer longitude lands 3 degrees from the DR; Hc worked at the answer must equal Ho
const ms2 = Date.parse('2032-01-14T22:05:47.319Z'), c2 = SF.single({ dr: { lat: -17.4052610881, lon: -141.5583273986, ms: ms2, course: 0, speed: 0 }, hoe: 0, ic: 0, temp: 10, pres: 1010, sights: [{ name: 'Moon', ms: ms2, hs: 64.6060007094, limb: 'L' }] });
if (c2.lonChron !== null) { const pm2 = S.place(ms2, 'Moon'), h2 = S.reduceBody(pm2, -17.4052610881, c2.lonChron); ok(Math.abs((h2.hc - c2.sights[0].ho) * 60) < 0.02, 'Moon chron longitude far from the DR: Hc at the answer = Ho, miss ' + ((h2.hc - c2.sights[0].ho) * 60).toFixed(3) + "'"); }
else ok(false, 'Codex case gave no longitude');
// a day fix: Sun and Moon (and Sun and Venus), with the working figures as in the Almanac adding up to the same intercept
{ const lat = 35.2, lon = -20.7, ms = Date.UTC(2026, 5, 10, 13, 0, 0), fr = S.frame(ms), mk = nm => { const p = S.place(ms, nm, fr), h = S.reduceBody(p, lat, lon); return { name: nm, ms, ho: h.hc, zn: h.zn, hc: h.hc }; };
  const sun = mk('Sun'), moon = mk('Moon'), ven = mk('Venus');
  console.log('day fix: Sun', sun.hc.toFixed(1), sun.zn.toFixed(0), '| Moon', moon.hc.toFixed(1), moon.zn.toFixed(0), '| Venus', ven.hc.toFixed(1), ven.zn.toFixed(0));
  [[sun, moon], [sun, ven]].forEach(pair => { if (pair[1].hc < 5) return; const res = SF.fix({ dr: { lat: lat - 0.1, lon: lon + 0.1, ms, course: 0, speed: 0 }, hoe: 0, ic: 0, temp: 10, pres: 1010, sights: pair.map(x => ({ name: x.name, ms: x.ms, ho: x.ho })) });
    const e = res.error ? 99 : Math.hypot((res.fix.lat - lat) * 60, (res.fix.lon - lon) * 60 * Math.cos(lat * R)); ok(e < 0.05, 'Sun + ' + pair[1].name + ' fix error ' + e.toFixed(3) + ' NM ' + (res.error || ''));
    const m = res.sights && res.sights.find(s => s.kind === 'moon'); if (m) ok(Math.abs(((m.ho + m.pa / 60) - m.hcGeo) * 60 - m.a) < 1e-9 && Math.abs(m.lhaGeo - ((m.gha + m.ap.lon) % 360 + 360) % 360) < 1e-9, 'Moon working: Almanac-style Ho - Hc = intercept, LHA = GHA + long'); }); }
console.log(bad ? 'FAILED ' + bad + ' of ' + n : 'moon and planet tests passed: ' + n); process.exit(bad ? 1 : 0);
