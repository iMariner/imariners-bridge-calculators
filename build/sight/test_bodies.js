// Moon and planets against JPL DE440 (reference file from ref_bodies.py). usage: node test_bodies.js ref.json
const fs = require('fs'), S = new Function(fs.readFileSync(__dirname + '/engine.js', 'utf8') + 'return Sight;')();
const ref = JSON.parse(fs.readFileSync(process.argv[2])), st = {}, R = Math.PI / 180;
ref.forEach(r => { const nm = r.body[0].toUpperCase() + r.body.slice(1), p = S.place(r.ms, nm); const dg = ((p.gha - r.gha + 540) % 360 - 180) * 60 * Math.cos(r.dec * R), dd = (p.dec - r.dec) * 60, dk = nm === 'Moon' ? p.km - r.km : (p.au * 149597870.7 - r.km) / r.km;
  const s = st[nm] = st[nm] || { g: 0, d: 0, k: 0, n: 0 }; s.g = Math.max(s.g, Math.abs(dg)); s.d = Math.max(s.d, Math.abs(dd)); s.k = Math.max(s.k, Math.abs(dk)); s.n++; });
let bad = 0; Object.keys(st).forEach(k => { const s = st[k], lim = k === 'Moon' ? 0.2 : 0.05; console.log(k.padEnd(8), 'n', s.n, "max GHA x cos dec", s.g.toFixed(4) + "'", 'max Dec', s.d.toFixed(4) + "'", k === 'Moon' ? 'max dist ' + s.k.toFixed(1) + ' km' : 'max dist rel ' + s.k.toExponential(1)); if (s.g > lim || s.d > lim) bad++; });
console.log(bad ? 'FAILED' : 'bodies vs DE440 ok'); process.exit(bad ? 1 : 0);
