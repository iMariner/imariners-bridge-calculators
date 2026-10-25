// Passage plan maths against the owner's workbook (checked independently by an Opus review), against brute force, and edge cases.
const fs = require('fs'), html = fs.readFileSync(__dirname + '/../../Bridge-Calculators.html', 'utf8');
const course = html.slice(html.indexOf('  /* COURSE-BEGIN'), html.indexOf('/* COURSE-END */'));
const P = new Function(course + fs.readFileSync(__dirname + '/calc.js', 'utf8') + 'return Passage;')();
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const dm = x => { const a = Math.abs(x), d = Math.floor(a), m = (a - d) * 60; return d + '°' + m.toFixed(1) + "'"; };
// 1. workbook Great Circle example: 32 15 N 120 W to 25 N 121 E: 5904.0 NM, 307 / 228, vertex 47 20.4 N 174 26.9 W
let L = P.leg({ lat: 32.25, lon: -120 }, { lat: 25, lon: 121 }, { type: 'GC', step: 5 });
console.log('GC', L.gcDist.toFixed(1), 'NM', L.course.toFixed(2), L.finalCourse.toFixed(2), 'vertex', dm(L.vertex.lat), dm(L.vertex.lon), 'sailed', L.sailed.toFixed(1), 'rhumb', L.rlDist.toFixed(1), 'points', L.points.length);
ok(Math.abs(L.gcDist - 5904.0) < 0.1, 'GC distance'); ok(Math.abs(L.course - 306.748) < 0.01, 'initial course'); ok(Math.round(L.finalCourse) === 228, 'final course');
ok(Math.abs(L.vertex.lat - (47 + 20.4 / 60)) < 0.1 / 60 && Math.abs(L.vertex.lon - -(174 + 26.9 / 60)) < 0.1 / 60, 'vertex');
ok(L.sailed > L.gcDist && L.sailed < L.gcDist + 30 && L.rlDist > L.sailed, 'sailed between GC and rhumb');
// 2. every waypoint lies on the great circle (cross-track tiny) and the vertex is the highest point (brute force)
const v = p => [Math.cos(p.lat * Math.PI / 180) * Math.cos(p.lon * Math.PI / 180), Math.cos(p.lat * Math.PI / 180) * Math.sin(p.lon * Math.PI / 180), Math.sin(p.lat * Math.PI / 180)];
function xt(a, b, p) { const A = v(a), B = v(b), N = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]], m = Math.hypot(...N), Pp = v(p); return Math.asin((N[0] * Pp[0] + N[1] * Pp[1] + N[2] * Pp[2]) / m) * 180 / Math.PI * 60; }
ok(L.points.every(p => Math.abs(xt(L.from, L.to, p)) < 0.01), 'waypoints on the great circle');
let hi = -90; for (let f = 0; f <= 1; f += 1e-4) { const A = v(L.from), B = v(L.to), w = Math.acos(A[0] * B[0] + A[1] * B[1] + A[2] * B[2]), k1 = Math.sin((1 - f) * w) / Math.sin(w), k2 = Math.sin(f * w) / Math.sin(w); hi = Math.max(hi, Math.asin(k1 * A[2] + k2 * B[2]) * 180 / Math.PI); }
ok(Math.abs(hi - L.vertex.lat) < 0.01, 'vertex = brute-force highest latitude ' + hi.toFixed(4));
ok(L.points.slice(1, -1).every(p => Math.abs(p.lon / 5 - Math.round(p.lon / 5)) < 1e-9), 'waypoints on round 5 degree meridians');
// 3. composite with limiting latitude 45 N: course into V1 is 090/270 (tangent), V1 and V2 on 45 N, total = brute force sum
let C = P.leg({ lat: 32.25, lon: -120 }, { lat: 25, lon: 121 }, { type: 'GC', step: 5, limit: 45 });
console.log('CGC', C.type, 'V1', dm(C.V1.lat), C.V1.lon.toFixed(3), 'V2', C.V2.lon.toFixed(3), 'gc1', C.gc1.toFixed(1), 'par', C.parallel.toFixed(1), 'gc2', C.gc2.toFixed(1), 'total', C.gcDist.toFixed(1), 'sailed', C.sailed.toFixed(1));
ok(C.type === 'CGC' && Math.abs(C.V1.lat - 45) < 1e-9 && Math.abs(C.V2.lat - 45) < 1e-9, 'composite vertices on the limit');
// tangent: the great circle p1-V1 has its vertex at V1 (highest point of that arc is V1)
const gcP1V1 = P.course({ lat: 32.25, lon: -120 }, C.V1), arr = (P.course(C.V1, { lat: 32.25, lon: -120 }) + 180) % 360;
ok(Math.abs(Math.sin(arr * Math.PI / 180)) > 0.99999, 'arrives at V1 heading due west (tangent), course ' + arr.toFixed(3));
ok(C.gcDist > L.gcDist && C.points.every(p => p.lat <= 45 + 1e-9), 'composite longer than GC and never above 45 N');
const R_ = Math.PI / 180; ok(Math.abs(C.gc1 - Math.acos(Math.sin(32.25 * R_) / Math.sin(45 * R_)) / R_ * 60) < 0.01 && Math.abs(C.gc2 - Math.acos(Math.sin(25 * R_) / Math.sin(45 * R_)) / R_ * 60) < 0.01, 'composite great circle parts = textbook formula acos(sin lat / sin limit)');
ok(Math.abs(C.parallel - (Math.abs(((C.V2.lon - C.V1.lon) + 540) % 360 - 180)) * 60 * Math.cos(45 * R_)) < 0.01, 'parallel part = dlong x cos limit');
// 4. date line both ways, southern hemisphere, and short legs
let D = P.leg({ lat: -33.86, lon: 151.21 }, { lat: -36.85, lon: -75 }, { type: 'GC', step: 10 });
ok(D.vertex && D.vertex.lat < -50, 'Sydney to off Chile: southern vertex ' + D.vertex.lat.toFixed(2));
ok(D.points.slice(1, -1).every(p => Math.abs(p.lon) <= 180), 'longitudes normalised across the date line');
let W = P.leg({ lat: 35, lon: 179 }, { lat: 35, lon: -179 }, { type: 'GC' }); ok(Math.abs(W.gcDist - P.dist({ lat: 35, lon: 179 }, { lat: 35, lon: -179 })) < 1e-9 && W.gcDist < 100, 'short leg across 180: ' + W.gcDist.toFixed(1));
let RL = P.leg({ lat: 1, lon: 103.8 }, { lat: 6, lon: 80 }, { type: 'RL' }); ok(RL.type === 'RL' && RL.subs.length === 1, 'rhumb leg');
let M = P.leg({ lat: 10, lon: 20 }, { lat: 40, lon: 20 }, { type: 'GC', step: 5 }); ok(Math.abs(M.gcDist - 1800) < 1e-6 && Math.abs(M.course) < 1e-9, 'along a meridian');
let E = P.leg({ lat: 0, lon: 0 }, { lat: 0, lon: 60 }, { type: 'GC', step: 10 }); ok(Math.abs(E.gcDist - 3600) < 1e-6 && E.vertex === null && Math.abs(E.course - 90) < 1e-9, 'equator, no vertex');
console.log(bad ? 'FAILED ' + bad : 'passage tests passed: ' + n); process.exit(bad ? 1 : 0);
