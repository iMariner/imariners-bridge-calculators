// Tests of the running-fix maths: synthetic round trips, constant error, latitude line, date line, weak cuts, the owner's workbook.
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const { Sight, SightFix } = new Function(src('engine.js') + '\n' + src('fix.js') + '\nreturn { Sight, SightFix };')();
let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const R = Math.PI / 180, off = (a, b) => SightFix.offset(a, b), dist = (a, b) => { const o = off(a, b); return Math.hypot(o.dN, o.dE); };
function hsFor(hoTrue, o, body, limb, pl) {                                      // invert Sight.ho by bisection
  let lo = -0.5, hi = 90;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (Sight.ho(Object.assign({ hs: mid, body, limb, sd: pl.sd, hp: pl.hp }, o)).ho < hoTrue) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function makeCase(kind, extra, lr) {
  for (let tries = 0; tries < 5000; tries++) {
    const lat = lr ? (rnd() < 0.5 ? -1 : 1) * (lr[0] + rnd() * (lr[1] - lr[0])) : rnd() * 110 - 55, lon = rnd() * 360 - 180, course = rnd() * 360, speed = 6 + rnd() * 14;
    const tf = Date.UTC(2026, 9, 1) + Math.floor(rnd() * 400 * 86400000);
    const truth = { lat, lon }, o = { ic: rnd() * 4 - 2, hoe: 5 + rnd() * 25, temp: 5 + rnd() * 25, pres: 990 + rnd() * 40 };
    let times, names;
    if (kind === 'sun') { times = [tf - (2 + rnd() * 4) * 3600000, tf]; names = ['Sun', 'Sun']; }
    else {
      const all = Sight.bodiesAt(tf, lat, lon).filter(b => b.name !== 'Sun' && b.hc > 15 && b.hc < 70);
      if (all.length < 4) continue;
      const pick = [all[Math.floor(rnd() * all.length)]];
      while (pick.length < 4) { let best = null, bs = -1; all.forEach(c => { if (pick.includes(c)) return; const s = Math.min.apply(null, pick.map(p => { const d = Math.abs(c.zn - p.zn) % 360; return Math.min(d, 360 - d); })); if (s > bs) { bs = s; best = c; } }); pick.push(best); }
      if (!pick.every((p, i) => pick.every((q, j) => i === j || (Math.abs(p.zn - q.zn) % 360 > 25 && Math.abs(p.zn - q.zn) % 360 < 335)))) continue;
      times = pick.map((p, i) => tf - (3 - i) * 40000); names = pick.map(p => p.name);
    }
    const sights = [];
    let good = true;
    times.forEach((t, i) => {
      const P = SightFix.advance(lat, lon, course, -speed * (tf - t) / 3600000), f = Sight.frame(t), pl = names[i] === 'Sun' ? Sight.sunPlace(t, f) : Sight.starPlace(t, names[i], f), r = Sight.reduce(P.lat, P.lon, pl.gha, pl.dec);
      if (r.hc < 12 || r.hc > 70) good = false;
      const body = names[i] === 'Sun' ? 'sun' : 'star', limb = (i % 2 && kind === 'sun') ? 'U' : 'L';
      const hoTrue = r.hc; let hs = hsFor(hoTrue, o, body, limb, pl) + (extra || 0) / 60;
      sights.push({ name: names[i], ms: t, hs, limb, zn: r.zn });
    });
    if (!good) continue;
    if (kind === 'sun') { const d = Math.abs(sights[0].zn - sights[1].zn) % 360, dd = Math.min(d, 360 - d); if (dd < 35 || dd > 145) continue; }
    const ang = rnd() * 360, d0 = 5 + rnd() * 20, DRf = SightFix.advance(lat, lon, ang, d0);
    return { truth, tf, input: Object.assign({ dr: { lat: DRf.lat, lon: DRf.lon, ms: tf, course, speed }, sights }, o) };
  }
  throw new Error('no case');
}
// 1. round trips
let worst = { sun: 0, star: 0 };
for (let i = 0; i < 120; i++) { const k = i % 3 === 0 ? 'sun' : 'star', c = makeCase(k), r = SightFix.fix(c.input); ok(!r.error, 'solved'); const e = dist(r.fix, c.truth); worst[k] = Math.max(worst[k], e); ok(e < 0.1, k + ' round trip error ' + e.toFixed(3) + " NM"); }
console.log("round trip: worst error Sun " + worst.sun.toFixed(3) + " NM, stars " + worst.star.toFixed(3) + " NM (DR was 5 to 25 NM off)");
// 2. a constant altitude error of +2.0' is found and removed (stars)
let cw = 0, cs = 0, cn = 0; for (let i = 0; i < 40; i++) { const c = makeCase('star', 2.0), r = SightFix.fix(c.input); if (r.constErr === undefined) continue; cn++; cs = Math.max(cs, Math.abs(r.constErr - 2.0)); cw = Math.max(cw, dist(r.fixC, c.truth)); }
ok(cn >= 30 && cs < 0.1 && cw < 0.15, 'constant error found (' + cn + ' cases, max c error ' + cs.toFixed(3) + ", fix " + cw.toFixed(3) + ' NM)'); console.log("constant error +2.0': found within " + cs.toFixed(2) + "', corrected fix within " + cw.toFixed(2) + ' NM, ' + cn + ' cases');
// 3. latitude line (noon latitude) with one Sun sight
{ const c = makeCase('sun'); const inp = c.input; inp.sights = [inp.sights[0], { name: 'Latitude', ms: c.tf, lat: c.truth.lat }]; const r = SightFix.fix(inp); ok(!r.error && dist(r.fix, c.truth) < 0.1, 'one Sun sight plus noon latitude'); }
// 4. date line: true position 10 S 179.75 E at the sights, course 090, 15 knots, fix after crossing 180
{ const tf = Date.UTC(2026, 10, 20, 2, 0, 0), truth = { lat: -10, lon: -179.9 }, course = 90, speed = 15, o = { ic: 0.5, hoe: 12 };
  const names = ['Sun', 'Sun'], times = [tf - 3 * 3600000, tf], sights = times.map((t, i) => { const P = SightFix.advance(truth.lat, truth.lon, course, -speed * (tf - t) / 3600000), f = Sight.frame(t), pl = Sight.sunPlace(t, f), r = Sight.reduce(P.lat, P.lon, pl.gha, pl.dec); return { name: 'Sun', ms: t, hs: hsFor(r.hc, o, 'sun', 'L', pl), limb: 'L', hc: r.hc, zn: r.zn, P }; });
  ok(sights[0].P.lon > 179 && truth.lon < -179, 'sight 1 east of the date line, fix west of it');
  const usable = sights.every(s => s.hc > 8); if (usable) { const DR = SightFix.advance(truth.lat, truth.lon, 40, 12), r = SightFix.fix(Object.assign({ dr: { lat: DR.lat, lon: DR.lon, ms: tf, course, speed }, sights }, o)); ok(dist(r.fix, truth) < 0.15, 'date line fix error ' + dist(r.fix, truth).toFixed(3)); console.log('date line: fix ' + r.fix.lat.toFixed(3) + ' ' + r.fix.lon.toFixed(3) + ' error ' + dist(r.fix, truth).toFixed(3) + ' NM'); } else console.log('date line: Sun too low at the chosen time, skipped'); }
// 5. weak cut warns
{ const c = makeCase('sun'); const ins = c.input, s2 = ins.sights; ins.sights = [s2[0], Object.assign({}, s2[0], { ms: s2[0].ms + 600000 })]; const r = SightFix.fix(ins); ok(r.warnings.some(w => /only/.test(w)), 'weak cut warning: ' + JSON.stringify(r.warnings)); }
// 6. only one line: no fix
{ const c = makeCase('sun'); c.input.sights = [c.input.sights[0]]; const r = SightFix.fix(c.input); ok(r.error || r.warnings.length, 'one line cannot give a fix'); }
// 7. the owner's workbook example, using ITS observed altitudes (its refraction is 33% too large, so only the geometry is compared)
{ const t0 = Date.UTC(2026, 3, 14, 2, 48, 0), dr = { lat: 21 + 22.2 / 60, lon: 37 + 57.2 / 60, ms: t0, course: 332, speed: 12.4 };
  const sights = [['Fomalhaut', 0, 11 + 15.2 / 60], ['Spica', 33 * 86400 / 86440, 4 + 21.4 / 60], ['Schedar', 55 * 86400 / 86440, 18 + 49.1 / 60]].map(r => ({ name: r[0], ms: t0 + r[1] * 1000, ho: r[2] }));
  const r = SightFix.fix({ dr, sights, fixMs: t0 + 59.97 * 1000 });
  // workbook: observed 21 22.0 N, 037 57.4 E, set and drift 136.9 degrees 0.3 NM
  const wb = { lat: 21 + 22.0 / 60, lon: 37 + 57.4 / 60 }; const e = dist(r.fix, wb);
  console.log('workbook example: ours ' + (r.fix.lat * 60 % 60 + 0).toFixed(2) + " vs 22.0 N, distance between the two fixes " + e.toFixed(2) + " NM; intercepts (toward +): " + r.sights.map(s => s.a.toFixed(2)).join(', ') + ' (workbook p: 1.28, 1.35, 1.10 corrected)');
  ok(e < 0.6, 'workbook geometry'); }
// 8. Independent check of the solver: with noisy sights (+-1.5' errors) the answer must be the position that minimises the sum of squared altitude residuals,
//    found here by brute force (no linearisation, no iteration trick): a coarse grid then repeated refinement.
{ let w = 0, cnt = 0;
  for (let i = 0; i < 40; i++) {
    const c = makeCase(i % 2 ? 'sun' : 'star'), inp = c.input; inp.sights.forEach(s => { s.hs += (rnd() * 3 - 1.5) / 60; });
    if (inp.sights.length === 2 && i % 2) { /* two lines fit exactly: nothing to minimise, the brute force still finds the crossing */ }
    const r = SightFix.fix(inp); if (r.error) continue;
    const items = inp.sights.map(s => { const f = Sight.frame(s.ms), pl = s.name === 'Sun' ? Sight.sunPlace(s.ms, f) : Sight.starPlace(s.ms, s.name, f); const h = Sight.ho({ hs: s.hs, ic: inp.ic, hoe: inp.hoe, temp: inp.temp, pres: inp.pres, body: s.name === 'Sun' ? 'sun' : 'star', limb: s.limb, sd: pl.sd, hp: pl.hp }); return { ms: s.ms, pl, ho: h.ho }; });
    const tf = r.time, DR = SightFix.drAt(inp.dr, tf);
    const cost = (dN, dE) => { const Pf = SightFix.move(DR, dN, dE); let sum = 0; items.forEach(it => { const P = SightFix.advance(Pf.lat, Pf.lon, inp.dr.course, -inp.dr.speed * (tf - it.ms) / 3600000), x = Sight.reduce(P.lat, P.lon, it.pl.gha, it.pl.dec); sum += Math.pow((it.ho - x.hc) * 60, 2); }); return sum; };
    let bN = 0, bE = 0, step = 8, best = Infinity;
    for (let pass = 0; pass < 14; pass++) { let cN = bN, cE = bE; for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const v = cost(bN + a * step, bE + b * step); if (v < best) { best = v; cN = bN + a * step; cE = bE + b * step; } } bN = cN; bE = cE; step /= 2.2; }
    const bf = SightFix.move(DR, bN, bE), e = dist(bf, r.fix); w = Math.max(w, e); cnt++;
    ok(e < 0.03, 'brute force and least squares agree, difference ' + e.toFixed(4) + ' NM');
  }
  console.log('independent brute-force minimiser agrees with the solver on ' + cnt + ' noisy cases, worst difference ' + w.toFixed(4) + ' NM'); }
// 9. rhumb-line propagation against an independently written formula (classic Mercator sailing in nautical miles)
{ const MP = lat => (10800 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * R / 2)); let w = 0;
  for (let i = 0; i < 400; i++) { const lat = rnd() * 160 - 80, lon = rnd() * 360 - 180, C = rnd() * 360, D = rnd() * 400 - 100, p = SightFix.advance(lat, lon, C, D), lat2 = lat + D * Math.cos(C * R) / 60;
    if (Math.abs(lat2) > 84) continue;
    const dlon = Math.abs(Math.cos(C * R)) > 1e-6 ? Math.tan(C * R) * (MP(lat2) - MP(lat)) / 60 : D * Math.sin(C * R) / 60 / Math.cos(lat * R), lon2 = ((lon + dlon + 540) % 360 + 360) % 360 - 180;
    w = Math.max(w, Math.hypot((p.lat - lat2) * 60, (((p.lon - lon2 + 540) % 360) - 180) * 60 * Math.cos(lat * R))); }
  ok(w < 0.001, 'rhumb propagation matches the independent formula, worst ' + w.toFixed(5) + ' NM'); console.log('rhumb propagation vs independent formula: worst difference ' + w.toFixed(5) + ' NM'); }
// 10. input and failure handling: no course, polar latitude, wild DR
{ const c = makeCase('star'); let i2 = JSON.parse(JSON.stringify(c.input)); delete i2.dr.course; ok(SightFix.fix(i2).error, 'missing course is an error');
  i2 = JSON.parse(JSON.stringify(c.input)); i2.dr.lat = 88; ok(SightFix.fix(i2).error, 'latitude 88 is refused');
  i2 = JSON.parse(JSON.stringify(c.input)); i2.sights[0].hs = NaN; ok(SightFix.fix(i2).error, 'bad altitude is an error');
  i2 = JSON.parse(JSON.stringify(c.input)); i2.sights[0].ms = Date.UTC(2090, 0, 1); ok(SightFix.fix(i2).error, 'date outside 2000 to 2060 is an error'); }
// 11. high latitudes and long transfers with noisy sights: the solver must still sit on the least-squares minimum (the earlier fixed-azimuth version did not)
{ let w = 0, cnt = 0; for (let i = 0; i < 24; i++) {
    const c = makeCase('sun', 0, [62, 80]), inp = c.input; inp.sights.forEach(s => { s.hs += (rnd() * 3 - 1.5) / 60; });
    const r = SightFix.fix(inp); if (r.error) continue;
    const items = inp.sights.map(s => { const f = Sight.frame(s.ms), pl = Sight.sunPlace(s.ms, f); const h = Sight.ho({ hs: s.hs, ic: inp.ic, hoe: inp.hoe, temp: inp.temp, pres: inp.pres, body: 'sun', limb: s.limb, sd: pl.sd, hp: pl.hp }); return { ms: s.ms, pl, ho: h.ho }; });
    const tf = r.time, DR = SightFix.drAt(inp.dr, tf);
    const cost = (dN, dE) => { const Pf = SightFix.move(DR, dN, dE); let sum = 0; items.forEach(it => { const P = SightFix.advance(Pf.lat, Pf.lon, inp.dr.course, -inp.dr.speed * (tf - it.ms) / 3600000), x = Sight.reduce(P.lat, P.lon, it.pl.gha, it.pl.dec); sum += Math.pow((it.ho - x.hc) * 60, 2); }); return sum; };
    let bN = 0, bE = 0, step = 8, best = Infinity; for (let pass = 0; pass < 14; pass++) { let cN = bN, cE = bE; for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const v = cost(bN + a * step, bE + b * step); if (v < best) { best = v; cN = bN + a * step; cE = bE + b * step; } } bN = cN; bE = cE; step /= 2.2; }
    const e = dist(SightFix.move(DR, bN, bE), r.fix); w = Math.max(w, e); cnt++; ok(e < 0.03, 'high latitude agreement ' + e.toFixed(4)); }
  console.log('latitudes 62 to 80, Sun sights up to 6 h apart: solver vs brute-force minimiser, ' + cnt + ' cases, worst difference ' + w.toFixed(4) + ' NM'); }
console.log('fix tests passed: ' + n);
