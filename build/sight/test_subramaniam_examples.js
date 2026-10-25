// Capt. H. Subramaniam, Practical Navigation (Nutshell Series Book 1, 2010): 26 worked examples from ch. 10, 14-18 and 24 (1992 almanac), written by the Opus review on 25 Oct 2026.
// Subramaniam Practical Navigation Book 1 (2010) worked examples against the Sight Fix engine. Read-only.
const fs = require('fs'), D = __dirname + '/', src = f => fs.readFileSync(D + f, 'utf8');
const M = new Function(src('engine.js') + src('fix.js') + 'return {S:Sight,F:SightFix}')(), S = M.S, F = M.F;
const R = Math.PI / 180, dm = (d, m) => (d < 0 || Object.is(d, -0) ? -1 : 1) * (Math.abs(d) + m / 60);
const g = (mo, d, h, mi, s) => Date.UTC(1992, mo - 1, d, h, mi, s || 0);
const fmt = x => { const s = x < 0 ? '-' : ''; x = Math.abs(x); let d = Math.floor(x), m = (x - d) * 60; if (m >= 59.95) { d++; m = 0; } return s + d + ' ' + m.toFixed(1).padStart(4, '0'); };
const ang = (a, b) => (((a - b) % 360 + 540) % 360 - 180) * 60;
const out = [];
function rep(id, page, what, book, app, unit) {
  const d = unit === 'deg' ? ang(app, book) / 60 : (unit === "'" ? app - book : ang(app, book));
  out.push([id, page, what, unit === 'deg' ? book.toFixed(1) : unit === "'" ? book.toFixed(1) : fmt(book), unit === 'deg' ? app.toFixed(1) : unit === "'" ? app.toFixed(2) : fmt(app), (unit === 'deg' ? d.toFixed(2) + ' deg' : d.toFixed(2) + "'")]);
}
const base = { temp: 10, pres: 1010, anyYear: true };
function one(ms, lat, lon, name, hs, ic, hoe, limb) { return F.single(Object.assign({}, base, { ic, hoe, dr: { lat, lon, ms, course: 0, speed: 0 }, sights: [{ name, ms, hs, limb: limb || 'L' }] })); }
function place(ms, name) { return S.place(ms, name); }
function almanac(id, page, ms, name, gha, dec) { const p = place(ms, name); rep(id, page, name + ' GHA (almanac)', gha, p.gha); rep(id, page, name + ' Dec (almanac)', dec, p.dec); }

// ch10 p52: Sun LL 16 Mar 1992 (time not given: 12h used)
{ const ms = g(3, 16, 12, 0), p = place(ms, 'Sun'), c = S.ho({ hs: dm(56, 11.4), ic: 2.8, hoe: 12, body: 'sun', limb: 'L', sd: p.sd, hp: p.hp });
  rep('ch10 Sun', 52, 'true altitude', dm(56, 23.7), c.ho); }
// ch10 p54: Moon LL, HP 54.6 and UL HP 56.0 (date not given). Engine leaves Moon parallax inside Hc; add it here like the book: geocentric alt.
function moonT(hs, ic, hoe, hp, limb) {
  const sdg = 0.2724 * hp, ha0 = hs + (ic - 1.76 * Math.sqrt(hoe)) / 60, sdt = sdg * (1 + Math.sin(ha0 * R) * Math.sin(hp / 60 * R));
  const c = S.ho({ hs, ic, hoe, body: 'moon', limb, sd: sdt }), hTopo = c.ho;   // refraction and SD only
  return hTopo + Math.asin(Math.sin(hp / 60 * R) * Math.cos(hTopo * R)) / R;    // + parallax in altitude
}
rep('ch10 Moon LL', 54, 'true altitude', dm(43, 10.2), moonT(dm(42, 24.6), -2.4, 12, 54.6, 'L'));
rep('ch10 Moon UL', 54, 'true altitude', dm(56, 39.2), moonT(dm(56, 27.1), 3.8, 15, 56.0, 'U'));

// ch14 p84 meridian altitude Sun
{ const ms = g(9, 23, 1, 4, 16), r = one(ms, dm(23, 40), dm(161, 56), 'Sun', dm(66, 10.6), -2.3, 10.5, 'L');
  almanac('14.1 mer alt Sun', 84, ms, 'Sun', null, -dm(0, 6.2)); out.pop(); out.pop(); const p = place(ms, 'Sun'); rep('14.1 mer alt Sun', 84, 'Sun Dec', -dm(0, 6.2), p.dec);
  rep('14.1 mer alt Sun', 84, 'true alt', dm(66, 18.1), r.sights[0].ho); rep('14.1 mer alt Sun', 84, 'latitude', dm(23, 35.7), r.latChron); }
// ch14 p87 azimuth Sun
{ const ms = g(9, 13, 13, 10, 22); almanac('14.2 az Sun', 87, ms, 'Sun', dm(18, 38.9), dm(3, 34.3)); const p = place(ms, 'Sun'), z = S.reduce(dm(-23, 21), -dm(47, 18), p.gha, p.dec);
  rep('14.2 az Sun', 87, 'true azimuth', 49.8, z.zn, 'deg'); }
// ch14 p89 amplitude Sun (rising, true alt 0 at rational horizon)
{ const ms = g(3, 4, 18, 28, 56), p = place(ms, 'Sun'); rep('14.3 amplitude', 90, 'Sun Dec', -dm(6, 7.5), p.dec);
  const amp = Math.asin(Math.sin(p.dec * R) / Math.cos(dm(32, 12) * R)) / R; rep('14.3 amplitude', 90, 'true bearing 090-amp', 97.2, 90 - amp, 'deg'); }
// ch14 p91-97 long by chron and intercept, Sun UL
{ const ms = g(11, 29, 17, 47, 49), r = one(ms, dm(26, 27), -dm(130, 27), 'Sun', dm(28, 11.0), 2.3, 10, 'U'), s = r.sights[0];
  almanac('14.4/14.5 Sun', 92, ms, 'Sun', dm(89, 49.4), -dm(21, 36.4));
  rep('14.4/14.5 Sun', 92, 'true alt', dm(27, 49.9), s.ho); rep('14.4 long chron', 92, 'longitude', -dm(130, 32.6), r.lonChron); rep('14.4 long chron', 92, 'azimuth', 136.7, s.zn, 'deg');
  rep('14.5 intercept', 96, 'intercept (+toward)', -3.4, s.a, "'"); rep('14.5 intercept', 97, 'azimuth', 136.8, s.zn, 'deg'); }
// ch14 p99 ex-meridian Sun
{ const ms = g(3, 4, 23, 14, 44), r = one(ms, dm(27, 18), -dm(168, 11), 'Sun', dm(56, 19.8), -2.8, 12, 'L');
  almanac('14.6 ex-mer Sun', 99, ms, 'Sun', dm(165, 47.4), -dm(6, 3.0)); rep('14.6 ex-mer Sun', 99, 'true alt', dm(56, 26.5), r.sights[0].ho);
  rep('14.6 ex-mer Sun', 99, 'obs latitude', dm(27, 25.6), r.latChron); rep('14.6 ex-mer Sun', 99, 'azimuth', 175.7, r.sights[0].zn, 'deg'); }
// ch15 p103 Procyon meridian altitude
{ const ms = g(11, 30, 21, 58, 53), r = one(ms, -dm(45, 20), 75, 'Procyon', dm(39, 28.8), 1.5, 25);
  rep('15.1 Procyon mer', 103, 'Dec', dm(5, 14.6), place(ms, 'Procyon').dec); rep('15.1 Procyon mer', 103, 'true alt', dm(39, 20.3), r.sights[0].ho); rep('15.1 Procyon mer', 103, 'latitude', -dm(45, 25.1), r.latChron); }
// ch15 p105 Canopus azimuth
{ const ms = g(9, 22, 7, 31, 4), p = place(ms, 'Canopus'); rep('15.2 Canopus az', 106, 'GHA star', dm(114, 11.0) + dm(264, 3.1) - 360, p.gha); rep('15.2 Canopus az', 106, 'Dec', -dm(52, 41.2), p.dec);
  rep('15.2 Canopus az', 106, 'true azimuth', 147.2, S.reduce(-dm(43, 18), -dm(140, 11), p.gha, p.dec).zn, 'deg'); }
// ch15 p107-113 Spica long by chron and intercept
{ const ms = g(8, 23, 18, 17, 19), r = one(ms, -dm(34, 31), -dm(3, 30), 'Spica', dm(45, 27.2), -2.1, 11), s = r.sights[0];
  almanac('15.3/15.4 Spica', 108, ms, 'Spica', dm(45, 24.9), -dm(11, 7.4)); rep('15.3/15.4 Spica', 108, 'true alt', dm(45, 18.3), s.ho);
  rep('15.3 long chron', 108, 'longitude', -dm(3, 29.5), r.lonChron); rep('15.4 intercept', 112, 'intercept (+toward)', -0.4, s.a, "'"); rep('15.4 intercept', 112, 'azimuth', 291.2, s.zn, 'deg'); }
// ch15 p115 Capella ex-meridian
{ const ms = g(3, 2, 12, 32, 18), r = one(ms, dm(16, 12), dm(92, 10), 'Capella', dm(60, 29.4), 2.0, 48), s = r.sights[0];
  almanac('15.5 Capella ex-mer', 116, ms, 'Capella', dm(348, 37.5) + dm(280, 57.9) - 360, dm(45, 59.6)); rep('15.5 Capella ex-mer', 116, 'true alt', dm(60, 18.6), s.ho);
  rep('15.5 Capella ex-mer', 116, 'obs latitude', dm(16, 20.3), r.latChron); rep('15.5 Capella ex-mer', 116, 'azimuth', 357.5, s.zn, 'deg'); }
// ch15 p118 Polaris
{ const ms = g(8, 31, 17, 22, 26), r = one(ms, 18, dm(178, 11), 'Polaris', dm(18, 47.4), -1.6, 12.5), s = r.sights[0];
  const pa = place(ms, 'Polaris'); rep('15.6 Polaris', 119, 'GHA Aries', dm(240, 44.7), pa.gha - pa.sha);
  rep('15.6 Polaris', 119, 'true alt', dm(18, 36.8), s.ho); rep('15.6 Polaris', 119, 'latitude', dm(17, 54.2), r.latChron); rep('15.6 Polaris', 119, 'azimuth', 359.7, s.zn, 'deg'); }
// ch16 p121 Jupiter meridian altitude
{ const ms = g(6, 15, 10, 58, 18), r = one(ms, -45, dm(91, 10), 'Jupiter', dm(35, 14.2), -0.5, 9), s = r.sights[0];
  rep('16.1 Jupiter mer', 121, 'Dec', dm(9, 47.9), place(ms, 'Jupiter').dec); rep('16.1 Jupiter mer', 121, 'true alt', dm(35, 7.0), s.ho); rep('16.1 Jupiter mer', 121, 'latitude', -dm(45, 5.1), r.latChron);
  rep('16.1 Jupiter mer', 122, 'GHA at 10h (mer pass check)', dm(254, 13.4), place(g(6, 15, 10, 0), 'Jupiter').gha); }
// ch16 p124 Venus azimuth
{ const ms = g(12, 1, 9, 8, 4); almanac('16.2 Venus az', 124, ms, 'Venus', dm(274, 3.2), -dm(24, 3.4)); const p = place(ms, 'Venus');
  rep('16.2 Venus az', 124, 'true azimuth', 232.1, S.reduce(dm(36, 27), dm(144, 44), p.gha, p.dec).zn, 'deg'); }
// ch16 p126-131 Mars long by chron and intercept
{ const ms = g(8, 31, 8, 15, 2), r = one(ms, dm(60, 6), -dm(66, 18), 'Mars', dm(41, 32.4), -2.1, 10), s = r.sights[0];
  almanac('16.3/16.4 Mars', 126, ms, 'Mars', dm(21, 8.3), dm(22, 56.9)); rep('16.3/16.4 Mars', 126, 'true alt', dm(41, 23.7), s.ho);
  rep('16.3 long chron', 127, 'longitude', -dm(66, 22.6), r.lonChron); rep('16.4 intercept', 130, 'intercept (+toward)', -2.0, s.a, "'"); rep('16.4 intercept', 131, 'azimuth', 119.4, s.zn, 'deg'); }
// ch16 p133 Mars ex-meridian (question prints 13 23.1, working uses 31 23.1)
{ const ms = g(11, 29, 20, 5, 40), r = one(ms, -dm(34, 57), dm(119, 50), 'Mars', dm(31, 23.1), -0.4, 17), s = r.sights[0];
  almanac('16.5 Mars ex-mer', 133, ms, 'Mars', dm(250, 8.7), dm(23, 5.0)); rep('16.5 Mars ex-mer', 133, 'true alt', dm(31, 14.0), s.ho);
  rep('16.5 Mars ex-mer', 133, 'obs lat (tables)', -dm(34, 54.8), r.latChron); rep('16.5 Mars ex-mer', 134, 'obs lat (calculator)', -dm(34, 55.0), r.latChron); rep('16.5 Mars ex-mer', 134, 'azimuth', 349.3, s.zn, 'deg'); }
// ch17 p139 Moon meridian altitude UL
{ const ms = g(2, 24, 22, 44, 0), r = one(ms, dm(10, 5), dm(103, 16), 'Moon', dm(56, 14.9), -1.6, 12, 'U'), s = r.sights[0];
  rep('17.2 Moon mer', 139, 'Dec', -dm(23, 24.8), place(ms, 'Moon').dec); rep('17.2 Moon mer', 139, 'latitude', dm(10, 12.8), r.latChron);
  rep('17.2 Moon mer', 139, 'true alt (Ho + parallax in alt)', dm(56, 22.4), s.ho + s.pa / 60); }
// ch17 p140 Moon azimuth
{ const ms = g(3, 6, 19, 30, 56); almanac('17.3 Moon az', 141, ms, 'Moon', dm(88, 16.3), dm(9, 25.9)); const p = place(ms, 'Moon');
  rep('17.3 Moon az', 141, 'true azimuth', 102.2, S.reduce(dm(30, 30), -dm(140, 11), p.gha, p.dec).zn, 'deg'); }
// ch17 p142-148 Moon long by chron and intercept UL
{ const ms = g(2, 25, 14, 52, 16), r = one(ms, -dm(20, 4), -dm(90, 4), 'Moon', dm(52, 26.8), 0.6, 19, 'U'), s = r.sights[0];
  almanac('17.4/17.5 Moon', 143, ms, 'Moon', dm(130, 20.3), -dm(24, 18.3)); rep('17.4/17.5 Moon', 143, 'true alt (Ho + parallax in alt)', dm(52, 37.8), s.ho + s.pa / 60);
  rep('17.4 long chron', 143, 'longitude', -dm(90, 6.2), r.lonChron); rep('17.5 intercept', 147, 'intercept tables (+toward)', 2.1, s.a, "'"); rep('17.5 intercept', 148, 'intercept calculator', 2.0, s.a, "'"); rep('17.5 intercept', 147, 'azimuth', 255.9, s.zn, 'deg'); }
// ch17 p149 Moon ex-meridian UL
{ const ms = g(11, 29, 9, 23, 25), r = one(ms, -dm(36, 8), dm(96, 40), 'Moon', dm(68, 53.7), 0.2, 14, 'U'), s = r.sights[0];
  almanac('17.6 Moon ex-mer', 150, ms, 'Moon', dm(261, 50.5), -dm(15, 9.2)); rep('17.6 Moon ex-mer', 150, 'obs latitude', -dm(36, 14.8), r.latChron); rep('17.6 Moon ex-mer', 150, 'azimuth', 4.0, s.zn, 'deg'); }
// ch24 p219 Sun LL below the pole
{ const ms = g(6, 15, 13, 36, 28), r = one(ms, 77, dm(156, 8), 'Sun', dm(10, 14.8), -1.6, 11, 'L'), s = r.sights[0];
  rep('24 ex8 Sun below pole', 219, 'Dec', dm(23, 20.1), place(ms, 'Sun').dec); rep('24 ex8 Sun below pole', 219, 'true alt', dm(10, 18.2), s.ho);
  rep('24 ex8 Sun below pole', 219, 'latitude', dm(76, 58.1), r.latChron); rep('24 ex8 Sun below pole', 219, 'azimuth', 0, s.zn, 'deg'); }
// ch24 p220 Moon UL below the pole, South latitude (book prints N: misprint)
{ const ms = g(2, 25, 9, 58, 0), r = one(ms, -dm(71, 25), dm(120, 42), 'Moon', dm(5, 7.2), -0.2, 13, 'U'), s = r.sights[0];
  rep('24 ex9 Moon below pole', 220, 'Dec', -dm(24, 5.5), place(ms, 'Moon').dec); rep('24 ex9 Moon below pole', 220, 'true alt (Ho + par)', dm(5, 30.9), s.ho + s.pa / 60);
  rep('24 ex9 Moon below pole', 220, 'latitude', -dm(71, 25.4), r.latChron); rep('24 ex9 Moon below pole', 220, 'azimuth', 180, s.zn, 'deg'); out.push(['', '', 'warnings: ' + r.warnings.join(' | ')]); }

// ch18 combinations: given position lines, so a test body is set up for each line with the book's azimuth and intercept.
const realPlace = S.place;
function fake(lines, dr) {  // lines: {zn, a (+toward), P (point the line is worked from), t (ms)}
  const bodies = {};
  lines.forEach((L, i) => { const d = 40 * R, la = L.P.lat * R, z = L.zn * R, lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(z));
    const lon2 = L.P.lon * R + Math.atan2(Math.sin(z) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
    bodies['X' + i] = { name: 'X' + i, kind: 'star', gha: ((-lon2 / R) % 360 + 360) % 360, dec: lat2 / R, sd: 0, hp: 0 };
    L.ho = S.reduce(L.P.lat, L.P.lon, bodies['X' + i].gha, bodies['X' + i].dec).hc + L.a / 60; });
  S.place = (ms, n, f) => bodies[n] || realPlace(ms, n, f);
  const r = F.fix(Object.assign({}, base, { ic: 0, hoe: 0, dr, fixMs: Math.max.apply(null, lines.map(l => l.t)), sights: lines.map((L, i) => ({ name: 'X' + i, ms: L.t, ho: L.ho })) }));
  S.place = realPlace; return r;
}
{ const t = g(1, 1, 0, 0), P = { lat: -dm(36, 18), lon: dm(93, 27) }, r = fake([{ zn: 120, a: 3.2, P, t }, { zn: 20, a: -1.8, P, t }], Object.assign({ ms: t, course: 0, speed: 0 }, P));
  rep('18 A2 two intercepts', 156, 'fix lat', -dm(36, 20.7), r.fix.lat); rep('18 A2 two intercepts', 156, 'fix long', dm(93, 29.6), r.fix.lon); }
{ const t = g(1, 1, 0, 0), P = { lat: -dm(20, 11), lon: dm(140, 36) }, r = fake([{ zn: 42, a: -3.2, P, t }, { zn: 100, a: 5.6, P, t }, { zn: 170, a: 8.2, P, t }], Object.assign({ ms: t, course: 0, speed: 0 }, P));
  rep('18 A9 three intercepts', 163, 'fix lat', -dm(20, 18.8), r.fix.lat); rep('18 A9 three intercepts', 163, 'fix long', dm(140, 40.5), r.fix.lon);
  out.push(['', '', 'A9 residuals: ' + JSON.stringify(r.fix && Object.keys(r.fix)), JSON.stringify(r.lines ? r.lines.map(l => l.res) : r.residuals || '')]); }
{ // B4: intercept 6.3 away Az 130 at 56 11N 72 23E, run 243 T 43 M, then 2.2 toward Az 210 from 2nd DR
  const t1 = g(1, 1, 0, 0), t2 = t1 + 43 / 10 * 3600000, P1 = { lat: dm(56, 11), lon: dm(72, 23) }, P2 = F.advance(P1.lat, P1.lon, 243, 43);
  const r = fake([{ zn: 130, a: -6.3, P: P1, t: t1 }, { zn: 210, a: 2.2, P: P2, t: t2 }], { lat: P1.lat, lon: P1.lon, ms: t1, course: 243, speed: 10 });
  rep('18 B4 running fix', 170, '2nd DR lat', dm(55, 51.5), P2.lat); rep('18 B4 running fix', 170, '2nd DR long', dm(71, 14.5), P2.lon);
  rep('18 B4 running fix', 170, 'fix lat', dm(55, 52.8), r.fix.lat); rep('18 B4 running fix', 170, 'fix long', dm(71, 2.0), r.fix.lon); }

for (const o of out) console.log(o.map((x, i) => String(x).padEnd([24, 4, 34, 12, 12, 10][i] || 0)).join(' '));
// pass / fail: every worked example within 0.35' (positions, altitudes, intercepts) or 0.2 degree (bearings)
let bad = 0, n = 0;
for (const o of out) { const d = String(o[5] || ''); if (!d) continue; n++; const v = parseFloat(d); if (d.indexOf('deg') >= 0 ? Math.abs(v) > 0.2 : Math.abs(v) > 0.35) { bad++; console.log('FAIL', o.join(' | ')); } }
console.log(bad ? 'FAILED ' + bad + ' of ' + n : 'Subramaniam worked examples passed: ' + n);
process.exit(bad ? 1 : 0);
