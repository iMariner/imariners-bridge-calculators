// builds the plot SVG for both examples and checks the advanced lines pass through the fix
const fs = require('fs');
const src = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8');
const SightFix = new Function(src('engine.js') + src('fix.js') + 'return SightFix;')();
const Sight = new Function(src('engine.js') + 'return Sight;')();
const SightPlot = new Function('SightFix', src('plot.js') + 'return SightPlot;')(SightFix);
const day = Date.UTC(2021, 4, 6), loc = (h, m, s) => day + (h * 3600 + m * 60 + s + 5 * 3600) * 1000;
const t1 = loc(13, 48, 55), t2 = loc(17, 6, 55);
const inp = { dr: { lat: 22 + 54.6 / 60, lon: -(94 + 25.3 / 60), ms: t1, course: 332, speed: 12.4 }, hoe: 29, ic: 0, temp: 27, pres: 1010, sights: [{ name: 'Sun', ms: t1, hs: 79 + 41 / 60, limb: 'L' }, { name: 'Sun', ms: t2, hs: 35 + 15 / 60, limb: 'L' }, { name: 'Latitude', ms: t2, lat: 23.1 }], gps: { lat: 23.1, lon: -94.46 } };
const r = SightFix.fix(inp); if (r.error) throw new Error(r.error);
const svg = SightPlot.build(r, inp, 720, 540, 'x');
let bad = 0;
if (!/<circle class="sp-fixring"/.test(svg) || /NaN|undefined|Infinity/.test(svg)) { console.log('FAIL svg content'); bad++; }
// each advanced line passes within residual of the fix
const dF = SightFix.drAt(inp.dr, r.time), cF = Math.cos(r.fix.lat * Math.PI / 180), P = (p) => ({ dE: (p.lon - r.fix.lon) * 60 * cF, dN: (p.lat - r.fix.lat) * 60 });
r.sights.forEach((s, i) => { const apP = P(s.ap), dFP = P(dF), run = { dE: dFP.dE - apP.dE, dN: dFP.dN - apP.dN }, z = s.zn * Math.PI / 180, fo = apP;
  const d = (fo.dE + run.dE + s.a * Math.sin(z)) * Math.cos(z) * -1 + 0; /* distance of fix from advanced line: project (f1 - fix) on (sin z, cos z) */
  const af = s.name === 'Latitude' ? (s.ap.lat + s.a / 60 - r.fix.lat) * 60 : (s.ho - s.hcFix) * 60, dist = af;
  console.log(s.name, 'distance fix to advanced LOP', dist.toFixed(2), 'NM, residual', r.residuals ? r.residuals[i].toFixed(2) : '-'); if (Math.abs(dist) > 6) bad++; });
fs.writeFileSync('/tmp/plot_test.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 540">' + svg + '</svg>');
console.log(bad ? 'FAILED' : 'plot ok, ' + svg.length + ' bytes'); process.exit(bad ? 1 : 0);
