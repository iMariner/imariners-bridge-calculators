// Random cases through the JS engine; the Python script compares them with ERFA/astropy.
// usage: node build/sight/gen_cases.js > cases.json
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const mod = new Function(src('../sun/calc.js') + '\n' + src('engine.js') + '\nreturn { SunTimes, Sight };')();
const { Sight, SunTimes } = mod;
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const t0 = Date.UTC(2026, 9, 1), t1 = Date.UTC(2027, 11, 31), names = Sight.names(), out = [];
for (let i = 0; i < 600; i++) {
  const ms = Math.round(t0 + rnd() * (t1 - t0)), lat = (rnd() * 150 - 75), lon = rnd() * 360 - 180;
  const isSun = i % 4 === 0, nm = isSun ? 'Sun' : names[Math.floor(rnd() * names.length)];
  const pl = isSun ? Sight.sunPlace(ms) : Sight.starPlace(ms, nm), r = Sight.reduce(lat, lon, pl.gha, pl.dec);
  out.push({ ms, lat, lon, body: nm, gha: pl.gha, dec: pl.dec, hc: r.hc, zn: r.zn });
}
console.log(JSON.stringify(out));
