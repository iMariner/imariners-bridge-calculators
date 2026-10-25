  /* SUN-BEGIN */
  /* Sunrise, sunset, twilight and meridian passage. Own high-precision Sun (Meeus ch. 25 with nutation and aberration, about 0.003 degrees),
     independent of the low-precision almanac engine used for stars. Times are solved at the observer's position, not looked up from a table. */
  var SunTimes = (function () {
    var R = Math.PI / 180, DELTA_T = 69;                      /* TT - UT in seconds, about 69 s in 2026 */
    function mod(a, n) { return ((a % n) + n) % n; }
    function pos(ms) {                                       /* ms = UT as epoch milliseconds */
      var jd = ms / 86400000 + 2440587.5, T = (jd + DELTA_T / 86400 - 2451545) / 36525;
      var L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);
      var M = mod(357.52911 + 35999.05029 * T - 0.0001537 * T * T, 360), Mr = M * R;
      var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
      var Cc = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
      var v = M + Cc, rau = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(v * R));
      var Om = 125.04 - 1934.136 * T, lam = L0 + Cc - 0.00569 - 0.00478 * Math.sin(Om * R);
      var eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(Om * R);
      var ra = Math.atan2(Math.cos(eps * R) * Math.sin(lam * R), Math.cos(lam * R)) / R;
      var dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)) / R;
      var Tu = (jd - 2451545) / 36525;
      var gmst = mod(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * Tu * Tu - Tu * Tu * Tu / 38710000, 360);
      var dpsi = -0.004778 * Math.sin(Om * R) - 0.000367 * Math.sin(2 * L0 * R);
      var gast = gmst + dpsi * Math.cos(eps * R);
      return { gha: mod(gast - ra, 360), dec: dec, sd: 0.266563 / rau, eot: mod(L0 - ra + 180, 360) - 180, lon: mod(L0 + Cc, 360) };
    }
    function alt(ms, lat, lon) {                              /* geometric altitude of the Sun's centre, degrees; lon East + */
      var p = pos(ms), lha = (p.gha + lon) * R;
      return Math.asin(Math.sin(lat * R) * Math.sin(p.dec * R) + Math.cos(lat * R) * Math.cos(p.dec * R) * Math.cos(lha)) / R;
    }
    function wrapLha(ms, lon) { var p = pos(ms); return mod(p.gha + lon + 180, 360) - 180; }
    function bisect(f, a, b) {                                /* f(a) and f(b) have opposite signs */
      var fa = f(a);
      for (var i = 0; i < 40 && b - a > 250; i++) { var m = (a + b) / 2, fm = f(m); if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m; }
      return (a + b) / 2;
    }
    var LEVELS = [["astro", -18], ["nautical", -12], ["civil", -6]];
    /* where the ship is at time ms: fixed, or moving on a rhumb line. mv = { course (deg), speed (kn), ms (time of the given position) } */
    function mover(lat, lon, mv) {
      if (!mv || !(mv.speed > 0)) return function () { return { lat: lat, lon: lon }; };
      var c = mv.course * R;
      return function (ms) {
        var d = mv.speed * (ms - mv.ms) / 3600000, la = lat + d * Math.cos(c) / 60, la2 = Math.max(-89.9, Math.min(89.9, la));
        var dpsi = Math.log(Math.tan(Math.PI / 4 + la2 * R / 2)) - Math.log(Math.tan(Math.PI / 4 + lat * R / 2)), q = Math.abs(dpsi) > 1e-12 ? (la2 - lat) * R / dpsi : Math.cos(lat * R);
        return { lat: la2, lon: mod(lon + d * Math.sin(c) / q / 60 + 180, 360) - 180 };
      };
    }
    /* Moonrise and moonset: the Moon's upper limb on the visible horizon, worked from the observer (parallax inside), using the
       sight engine (Sight.moonPlace and reduceBody). Also the fraction of the Moon that is lit. */
    function moon(start, end, P, dip) {
      var out = { rise: [], set: [] }, step = 600000;
      function f(t) { var p = P(t), pl = Sight.moonPlace(t), r = Sight.reduceBody(pl, p.lat, p.lon); return r.hc + (34 / 60 + r.sd / 60 + dip); }
      var t0 = start, f0 = f(t0);
      for (var t = start + step; t <= end + 1; t += step) {
        var f1 = f(t);
        if ((f0 < 0) !== (f1 < 0)) { var tt = bisect(f, t0, t); if (f1 >= 0) out.rise.push(tt); else out.set.push(tt); }
        t0 = t; f0 = f1;
      }
      var mid = start + 43200000, s = Sight.sunPlace(mid), m = Sight.moonPlace(mid);
      var ce = Math.sin(s.dec * R) * Math.sin(m.dec * R) + Math.cos(s.dec * R) * Math.cos(m.dec * R) * Math.cos((s.ra - m.ra) * R);
      out.lit = (1 - ce) / 2; out.waxing = mod(m.ra - s.ra, 360) < 180;               /* elongation from the Sun; waxing while the Moon is east of the Sun */
      return out;
    }
    function solve(y, mo, d, zoneH, lat0, lon0, heightM, mv) {
      var P = mover(lat0, lon0, mv);
      var start = Date.UTC(y, mo - 1, d) - zoneH * 3600000, end = start + 86400000, step = 120000, n = Math.round((end - start) / step);
      var mid = pos(start + 43200000), dip = heightM > 0 ? 1.76 * Math.sqrt(heightM) / 60 : 0;
      var hSun = -(34 / 60 + mid.sd + dip);
      var levels = [["sun", hSun]].concat(LEVELS), res = { levels: {}, hSun: hSun, sd: mid.sd, dip: dip, transit: [], transitAlt: null, dec: pos(start + 43200000).dec, eot: pos(start + 43200000).eot, start: start, end: end };
      var ts = [], as = [];
      for (var i = 0; i <= n; i++) { var t = start + i * step, q = P(t); ts.push(t); as.push(alt(t, q.lat, q.lon)); }
      levels.forEach(function (lv) {
        var h0 = lv[1], rise = [], set = [], above = 0;
        for (var i = 0; i < n; i++) {
          var a = as[i] - h0, b = as[i + 1] - h0;
          if (a > 0) above++;
          if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) {
            var tt = bisect(function (x) { var q = P(x); return alt(x, q.lat, q.lon) - h0; }, ts[i], ts[i + 1]);
            if (b >= 0 && a < 0) rise.push(tt); else set.push(tt);
          }
        }
        res.levels[lv[0]] = { h0: h0, rise: rise, set: set, state: rise.length || set.length ? "normal" : (above > n / 2 ? "always-above" : "always-below") };
      });
      for (var j = 0; j < n; j++) {
        var l1 = wrapLha(ts[j], P(ts[j]).lon), l2 = wrapLha(ts[j + 1], P(ts[j + 1]).lon);
        if (l1 < 0 && l2 >= 0 && Math.abs(l1) < 90 && Math.abs(l2) < 90) {
          var tr = bisect(function (x) { return wrapLha(x, P(x).lon); }, ts[j], ts[j + 1]), qt = P(tr);
          res.transit.push(tr); res.transitAlt = alt(tr, qt.lat, qt.lon); res.transitPos = qt; res.dec = pos(tr).dec; res.eot = pos(tr).eot;
        }
      }
      var mn = Infinity, mx = -Infinity; as.forEach(function (x) { if (x < mn) mn = x; if (x > mx) mx = x; });
      res.minAlt = mn; res.maxAlt = mx; res.P = P;
      if (typeof Sight !== "undefined") res.moon = moon(start, end, P, dip);
      return res;
    }
    return { pos: pos, alt: alt, solve: solve };
  })();
  /* SUN-END */
