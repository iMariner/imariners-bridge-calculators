// Radar engine tests: synthetic tracks with known answers, brute-force CPA, action / find / resume checked by stepping time,
// relative bearings and gyro error, midnight, fixed object (set and drift), RYA worked examples that are self-consistent.
const fs = require('fs');
const Radar = new Function(fs.readFileSync(__dirname + '/radar.js', 'utf8') + 'return Radar;')();
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; if (bad < 30) console.log('FAIL', m); } };
const ad = (a, b) => Math.abs(Radar.n180(a - b));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const V = Radar.vec, hm = m => Radar.clock(m);
function brute(p, v, mins) { let best = Infinity, bt = 0; for (let t = 0; t <= mins; t += 0.01) { const d = Math.hypot(p.x + v.x * t / 60, p.y + v.y * t / 60); if (d < best) { best = d; bt = t; } } return { d: best, t: bt }; }
// 1. synthetic: own and target at constant velocity, three plots 6 min apart
for (let i = 0; i < 2000; i++) {
  const oc = rnd() * 360, os = rnd() * 25, tc = rnd() * 360, ts = rnd() * 25, t0 = Math.floor(rnd() * 1440);
  const p0 = V(rnd() * 360, 2 + rnd() * 10), rel = { x: V(tc, ts).x - V(oc, os).x, y: V(tc, ts).y - V(oc, os).y };
  const at = k => ({ x: p0.x + rel.x * k / 10, y: p0.y + rel.y * k / 10 });
  const relMode = rnd() < 0.5, hd = oc + (rnd() - 0.5) * 10, ge = relMode ? 0 : Math.round((rnd() - 0.5) * 6 * 10) / 10;
  const obs = [0, 1, 2].map(k => { const p = at(k), b = Radar.dirOf(p); return { t: hm(t0 + 6 * k), brg: relMode ? Radar.n360(b - hd) : Radar.n360(b - ge), rng: Math.hypot(p.x, p.y) }; });
  const c = { own: { course: oc, speed: os }, brgType: relMode ? 'rel' : 'true', heading: hd, ge, obs };
  const r = Radar.solve(Radar.normalize(c));
  if (ts > 0.5) { ok(ad(r.tgt.course, tc) < 0.01, 'tgt course ' + i + ' ' + r.tgt.course + ' vs ' + tc); }
  ok(Math.abs(r.tgt.speed - ts) < 0.001, 'tgt speed ' + i);
  ok(!r.mid[0].bad, 'middle plot flagged on a straight track ' + i);
  const b = brute(at(2), rel, 600);
  if (!r.cpa.passed && !r.cpa.steady) { if (r.cpa.tcpa < 590) ok(Math.abs(r.cpa.range - b.d) < 0.002, 'cpa ' + i + ' ' + r.cpa.range + ' vs ' + b.d); if (r.cpa.tcpa < 590) ok(Math.abs(r.cpa.tcpa - b.t) < 0.05, 'tcpa ' + i); }
  else ok(b.t < 0.02, 'opening but brute finds later CPA ' + i);
  if (r.aspect !== null) { const back = Radar.n360(Radar.dirOf(r.A) + 180); ok(ad(back - tc, r.aspect) < 0.01, 'aspect ' + i); }
  if (r.bcr) ok(Math.abs(Radar.relBrg(Radar.dirOf(r.bcr.p), oc)) < 0.1, 'bcr on course line ahead ' + i);
  if (r.scr) ok(Math.abs(Radar.relBrg(Radar.dirOf(r.scr.p), oc + 180)) < 0.1, 'scr on course line astern ' + i);
  // action: explicit, find course, find speed; checked by stepping time with the true velocities
  const ta = t0 + 12 + Math.floor(rnd() * 10), want = 1 + rnd() * 2, mode = ['course', 'speed', null][i % 3];
  const ca = Object.assign({}, c, { action: { t: hm(ta), find: mode, want, course: mode ? undefined : oc + 40, speed: undefined } });
  const ra = Radar.solve(Radar.normalize(ca)).action;
  const P = at(2 + (ta - t0 - 12) / 6);
  if (!ra.error) {
    const v2 = { x: V(tc, ts).x - V(ra.course, ra.speed).x, y: V(tc, ts).y - V(ra.course, ra.speed).y }, bb = brute(P, v2, 600);
    if (ra.tcpa < 590) ok(Math.abs(ra.cpa - bb.d) < 0.003, 'action cpa ' + i + ' ' + ra.cpa + ' vs ' + bb.d);
    if (mode) ok(ra.cpa >= want - 1e-6, 'found action reaches want ' + i);
    if (mode === 'course' && ra.stbdTurn > 0) { const c1 = ra.course - 1, v1 = { x: V(tc, ts).x - V(c1, os).x, y: V(tc, ts).y - V(c1, os).y }; ok(Radar.closest(P, v1).d < want, 'one degree less is not enough ' + i); }
    if (mode === 'speed' && ra.speed < os - 1e-9) { const s1 = Math.min(os, ra.speed + 0.1), v1 = { x: V(tc, ts).x - V(oc, s1).x, y: V(tc, ts).y - V(oc, s1).y }; ok(Radar.closest(P, v1).d < want, '0.1 kn more is not enough ' + i); }
    if (ra.resume) { // after resuming: never closer than want; one minute earlier is too early
      const Q = { x: P.x + v2.x * ra.resume.after / 60, y: P.y + v2.y * ra.resume.after / 60 };
      ok(brute(Q, rel, 600).d >= want - 0.005, 'resume keeps want ' + i);
      if (ra.resume.after >= 1) { const Q1 = { x: P.x + v2.x * (ra.resume.after - 1) / 60, y: P.y + v2.y * (ra.resume.after - 1) / 60 }; ok(Radar.closest(Q1, rel).d < want, 'resume one minute earlier is too early ' + i); }
    }
  } else ok(mode !== null, 'explicit action error ' + i + ' ' + ra.error);
}
// 2. fixed object: a buoy seen from a ship in a current
{ const oc = 40, os = 12, set = 135, drift = 2, g = { x: V(oc, os).x + V(set, drift).x, y: V(oc, os).y + V(set, drift).y }, b0 = { x: 3, y: 5 };
  const obs = [0, 6, 12].map(k => { const p = { x: b0.x - g.x * k / 60, y: b0.y - g.y * k / 60 }; return { t: hm(600 + k), brg: Radar.dirOf(p), rng: Math.hypot(p.x, p.y) }; });
  const r = Radar.solve(Radar.normalize({ own: { course: oc, speed: os }, brgType: 'true', obs, fixed: true }));
  ok(ad(r.ground.set, set) < 0.01 && Math.abs(r.ground.drift - drift) < 0.001, 'set and drift ' + r.ground.set + ' ' + r.ground.drift);
  ok(ad(r.ground.course, Radar.dirOf(g)) < 0.01 && Math.abs(r.ground.speed - Math.hypot(g.x, g.y)) < 0.001, 'course and speed made good'); }
// 3. midnight, time formats, a bent track is flagged
{ const N = Radar.normalize({ own: { course: 0, speed: 10 }, brgType: 'true', obs: [{ t: '23:57', brg: 10, rng: 5 }, { t: '0003', brg: 10, rng: 4 }], action: { t: '00:05' } });
  ok(N.obs[1].m - N.obs[0].m === 6 && N.action.m === 1445, 'midnight rollover');
  ok(Radar.minutes('7:05') === 425 && Radar.minutes('2460') === null && Radar.minutes('12.30') === 750, 'time formats');
  const r = Radar.solve(Radar.normalize({ own: { course: 0, speed: 10 }, brgType: 'true', obs: [{ t: '1000', brg: 30, rng: 6 }, { t: '1006', brg: 45, rng: 5 }, { t: '1012', brg: 32, rng: 4 }] }));
  ok(r.mid[0].bad && r.warn.length === 1, 'bent track flagged'); }
// 4. RYA radar course worked examples (owner's PDF), only answers that agree with their own diagram
const rya = [
  [{ own: { course: 180, speed: 10 }, brgType: 'rel', obs: [{ t: '1010', brg: 320, rng: 4 }, { t: '1016', brg: 320, rng: 3 }, { t: '1022', brg: 320, rng: 2 }] }, 250, 7.0, 0, 'Q1'],
  [{ own: { course: 30, speed: 5 }, brgType: 'rel', obs: [{ t: '1301', brg: 320, rng: 3.6 }, { t: '1307', brg: 312, rng: 2.3 }, { t: '1313', brg: 292, rng: 1.2 }] }, 168, 9.0, 0.7, 'Q2'],
  [{ own: { course: 110, speed: 5 }, brgType: 'true', obs: [{ t: '1440', brg: 64, rng: 4.6 }, { t: '1446', brg: 66, rng: 2.9 }, { t: '1452', brg: 77, rng: 1.2 }] }, 225, 15.0, null, 'Q5']];
rya.forEach(([c, crs, spd, cpa, id]) => { const r = Radar.solve(Radar.normalize(c));
  ok(ad(r.tgt.course, crs) < 2, id + ' course ' + r.tgt.course); ok(Math.abs(r.tgt.speed - spd) < 0.6, id + ' speed ' + r.tgt.speed);
  if (cpa !== null) ok(Math.abs(r.cpa.range - cpa) < 0.15, id + ' cpa ' + r.cpa.range); });
console.log(bad ? bad + ' of ' + n + ' checks FAILED' : 'radar ok, ' + n + ' checks');
process.exit(bad ? 1 : 0);
