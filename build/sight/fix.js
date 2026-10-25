  /* SIGHTFIX-BEGIN */
  /* Running fix from Sun or star sights (and an optional latitude line). Needs Sight (engine.js).
     Every sight is reduced from the DR position AT ITS OWN TIME; each line of position is carried to the fix time by the ship's
     course and speed (exactly, along the track); intercepts are then solved from the fix time position, repeating until the answer stops moving. */
  var SightFix = (function () {
    var R = Math.PI / 180;
    function norm180(x) { return ((x + 180) % 360 + 360) % 360 - 180; }
    function mercY(lat) { var l = Math.max(-85, Math.min(85, lat)); return Math.log(Math.tan(Math.PI / 4 + l * R / 2)) / R; }
    function advance(lat, lon, course, dist) {                                         /* rhumb line, dist in NM (may be negative) */
      var c = course * R, lat2 = lat + dist * Math.cos(c) / 60, dy = mercY(lat2) - mercY(lat), dl;
      dl = Math.abs(dy) > 1e-9 ? Math.tan(c) * dy : dist * Math.sin(c) / 60 / Math.cos(lat * R);
      return { lat: lat2, lon: norm180(lon + dl) };
    }
    function drAt(dr, ms) { return advance(dr.lat, dr.lon, dr.course, dr.speed * (ms - dr.ms) / 3600000); }
    function move(p, dN, dE) { var lat = p.lat + dN / 60, m = (lat + p.lat) / 2; return { lat: lat, lon: norm180(p.lon + dE / 60 / Math.cos(m * R)) }; }
    function offset(from, to) { var m = (from.lat + to.lat) / 2; return { dN: (to.lat - from.lat) * 60, dE: norm180(to.lon - from.lon) * 60 * Math.cos(m * R) }; }   /* NM */
    function solve(rows, withC) {                                                      /* least squares for (dN, dE[, c]); rows = [[cos zn, sin zn, a]] */
      var n = withC ? 3 : 2, A = [], b = [], i, j, k;
      for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); b.push(0); }
      rows.forEach(function (r) { var v = withC ? [r[0], r[1], r[3] === 0 ? 0 : 1] : [r[0], r[1]]; for (i = 0; i < n; i++) { b[i] += v[i] * r[2]; for (j = 0; j < n; j++) A[i][j] += v[i] * v[j]; } });
      var M = A.map(function (row, i2) { return row.concat(b[i2]); });
      for (i = 0; i < n; i++) {
        var p = i; for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
        if (Math.abs(M[p][i]) < 1e-9) return null;
        var t = M[i]; M[i] = M[p]; M[p] = t;
        for (k = i + 1; k < n; k++) { var f = M[k][i] / M[i][i]; for (j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
      }
      var x = new Array(n);
      for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
      return x;
    }
    function invTrace2(rows) {                                                         /* sqrt(trace((A'A)^-1)): how much a 1 minute error in each line grows in the fix */
      var a = 0, b = 0, d = 0; rows.forEach(function (r) { a += r[0] * r[0]; b += r[0] * r[1]; d += r[1] * r[1]; });
      var det = a * d - b * b; return det < 1e-9 ? Infinity : Math.sqrt((a + d) / det);
    }
    function gapOk(zns) {                                                              /* azimuths surround the observer: no gap of 180 degrees or more */
      var z = zns.slice().sort(function (x, y) { return x - y; }), max = 0;
      for (var i = 0; i < z.length; i++) { var g = (i + 1 < z.length ? z[i + 1] : z[0] + 360) - z[i]; if (g > max) max = g; }
      return max < 180;
    }
    /* input: { dr:{lat,lon,ms,course,speed}, hoe, ic, temp, pres, fixMs, gps:{lat,lon},
                sights:[{ name:"Sun"|star, ms, hs, limb:"L"|"U", ho (optional, degrees: used instead of hs) } | { name:"Latitude", ms, lat }] }  (lat, lon: east +, degrees; ms: UT epoch ms; ic in minutes, added) */
    function fix(inp) {
      var S = inp.sights, tf = inp.fixMs || Math.max.apply(null, S.map(function (s) { return s.ms; })), warn = [], dr = inp.dr;
      if (S.length < 2) warn.push("Two lines of position are needed for a fix.");
      for (var q = 0; q < S.length; q++) {
        var sq = S[q], yr = new Date(sq.ms).getUTCFullYear();
        if (!isFinite(sq.ms) || yr < 2000 || yr > 2060) return { error: "The date is outside 2000 to 2060, which the star and Sun data cover.", warnings: warn };
        if (sq.name !== "Latitude" && sq.ho === undefined && (!isFinite(sq.hs) || sq.hs < -1 || sq.hs > 90)) return { error: "Sextant altitude " + (q + 1) + " is not a number between 0 and 90 degrees.", warnings: warn };
      }
      if (!dr || !isFinite(dr.lat) || !isFinite(dr.lon) || !isFinite(dr.course) || !isFinite(dr.speed) || !isFinite(dr.ms)) return { error: "The DR position, course and speed are needed.", warnings: warn };
      if (Math.abs(dr.lat) > 84) return { error: "Latitudes above 84 degrees are not supported.", warnings: warn };
      var invalid = null, items = S.map(function (s) {
        var it = { s: s, lat: s.name === "Latitude" };
        if (it.lat) return it;
        var f = Sight.frame(s.ms), pl = Sight.place(s.ms, s.name, f);
        if (!pl) { invalid = invalid || s.name; return it; }
        it.pl = pl;
        if (s.ho !== undefined) it.ho = { ho: s.ho };
        else { var ap0 = drAt(dr, s.ms); it.ho = Sight.ho({ hs: s.hs, ic: inp.ic, hoe: inp.hoe, temp: inp.temp, pres: inp.pres, body: pl.kind, limb: s.limb || "L", sd: pl.kind === "moon" ? Sight.reduceBody(pl, ap0.lat, ap0.lon).sd : pl.sd, hp: pl.hp }); }
        if (it.ho.valid === false) invalid = s.name;
        return it;
      });
      if (invalid) return { error: invalid + ": the sextant altitude is below the horizon after the corrections (check the altitude, index error and height of eye).", warnings: warn };
      function lines(Pf) {                                                             /* intercepts and azimuths seen from the track positions that lead to Pf */
        return items.map(function (it) {
          var d = inp.dr.speed * (tf - it.s.ms) / 3600000, P = advance(Pf.lat, Pf.lon, dr.course, -d);
          if (it.lat) return { P: P, zn: 0, hc: null, a: (it.s.lat - P.lat) * 60 };
          var r = Sight.reduceBody(it.pl, P.lat, P.lon);
          return { P: P, zn: r.zn, hc: r.hc, lha: r.lha, a: (it.ho.ho - r.hc) * 60 };
        });
      }
      function jacobian(Pf, L) {                                                      /* how each intercept changes with a move of the fix: measured, not assumed, so the long transfers and high latitudes stay exact */
        var s = 0.25, N1 = lines(move(Pf, s, 0)), N2 = lines(move(Pf, -s, 0)), E1 = lines(move(Pf, 0, s)), E2 = lines(move(Pf, 0, -s));
        return L.map(function (l, i) { return [(N2[i].a - N1[i].a) / (2 * s), (E2[i].a - E1[i].a) / (2 * s), l.a, items[i].lat ? 0 : 1]; });
      }
      function iterate(withC) {
        var Pf = drAt(dr, tf), c = 0, L, k, x, rows, last = Infinity;
        for (k = 0; k < 20; k++) {
          L = lines(Pf); rows = jacobian(Pf, L);
          x = solve(rows, withC); if (!x) return null;
          var step = Math.hypot(x[0], x[1]), sc = step > 60 ? 60 / step : 1;           /* never jump more than 60 NM at once */
          Pf = move(Pf, x[0] * sc, x[1] * sc); if (withC) c = x[2];
          last = step; if (step < 0.002) break;
        }
        if (!isFinite(Pf.lat) || !isFinite(Pf.lon) || Math.abs(Pf.lat) > 89) return null;
        return { P: Pf, c: withC ? c : 0, L: lines(Pf), rows: rows, iters: k + 1, converged: last < 0.02 };
      }
      var base = iterate(false); if (!base) return { error: "The lines of position are parallel, too few, or too far from the DR: no fix.", warnings: warn };
      if (!base.converged) return { error: "The fix did not settle. Check the times, the altitudes and the DR.", warnings: warn };
      var DR = drAt(dr, tf), L0 = lines(DR), out = { time: tf, dr: DR, fix: base.P, iterations: base.iters, warnings: warn };
      out.sights = items.map(function (it, i) {
        var l0 = L0[i], lf = base.L[i], row = { name: it.s.name, ms: it.s.ms, ap: drAt(dr, it.s.ms), zn: l0.zn, a: l0.a, resid: lf.a };
        var apN = drAt(dr, it.s.ms), r2 = it.lat ? null : Sight.reduceBody(it.pl, apN.lat, apN.lon);
        if (!it.lat) { row.kind = it.pl.kind; row.hp = it.pl.hp; row.gha = it.pl.gha; row.dec = it.pl.dec; row.lha = r2.lha; row.hc = r2.hc; row.zn = r2.zn; row.ho = it.ho.ho; row.corr = it.ho; row.a = (it.ho.ho - r2.hc) * 60; row.hcFix = lf.hc; if (it.pl.kind === "moon") geoMoon(row, apN); if (r2.hc < 5) warn.push(it.s.name + " is below 5 degrees: refraction is unreliable."); else if (r2.hc < 10) warn.push(it.s.name + " is below 10 degrees: low altitude, less reliable."); if (r2.hc > 80) warn.push(it.s.name + " is above 80 degrees: a straight line is a poor approximation."); }
        if (Math.abs(row.a) > 20) warn.push((it.lat ? "Latitude" : it.s.name) + ": intercept " + Math.abs(row.a).toFixed(1) + "' is large. Check the time, Hs and the DR.");
        return row;
      });
      var o = offset(DR, base.P); out.dN = o.dN; out.dE = o.dE; out.distNM = Math.hypot(o.dN, o.dE); out.setDeg = out.distNM < 0.005 ? null : (Math.atan2(o.dE, o.dN) / R + 360) % 360;
      var hrs = (tf - dr.ms) / 3600000; out.driftKn = hrs > 0.05 ? out.distNM / hrs : null;
      var zns = base.rows.map(function (r) { return (Math.atan2(r[1], r[0]) / R + 360) % 360; });
      if (S.length === 2) { var cut = Math.abs(Math.sin((zns[0] - zns[1]) * R)); out.cutDeg = Math.round(Math.asin(cut) / R); if (cut < 0.5) warn.push("The two lines cross at only " + out.cutDeg + " degrees: the fix is weak. Use sights at least 30 degrees apart in azimuth (ideally about 90)."); }
      out.amplify = invTrace2(base.rows); if (S.length > 2 && out.amplify > 2.2) warn.push("The bodies are not well spread round the horizon: errors are magnified " + out.amplify.toFixed(1) + " times.");
      out.residuals = base.L.map(function (l) { return l.a; });
      /* sights that cannot be right: refuse rather than show a "fix" built on them */
      var far = out.sights.filter(function (s) { return Math.abs(s.a) > 180; });
      if (far.length) return { error: "No fix. " + far.map(function (s) { return s.name + " is " + Math.abs(s.a).toFixed(0) + "' (" + (Math.abs(s.a) / 60).toFixed(1) + "°) away from where the DR puts it"; }).join("; ") + ". This is almost always a wrong time (zone, hours or seconds), a wrong star or a wrong altitude. If the DR itself may be this far out, move the DR closer and try again.", warnings: warn };
      if (S.length >= 3) {
        var wi = 0; out.residuals.forEach(function (x, i) { if (Math.abs(x) > Math.abs(out.residuals[wi])) wi = i; });
        if (Math.abs(out.residuals[wi]) > 10) {
          /* lines that all miss by the same amount are one error common to every sight (index error on/off arc, height of eye), not one bad star */
          var cc0 = S.length >= 4 && gapOk(zns) ? iterate(true) : null, mxc = Infinity;      /* needs a spare line, or a constant explains any triangle */
          if (cc0) { mxc = 0; cc0.L.forEach(function (l, i) { mxc = Math.max(mxc, Math.abs(l.a - (items[i].lat ? 0 : cc0.c))); }); }
          if (mxc > 10) return { error: "No fix: the lines do not meet. " + out.sights[wi].name + " misses the best position by " + Math.abs(out.residuals[wi]).toFixed(0) + "'. Check its time, name and altitude, or leave it out." + (S.length === 3 ? " If all three look right, check the index error (on or off the arc) and the height of eye: an error common to every sight also opens up the triangle." : ""), warnings: warn };
          warn.push("Every line is off by about " + Math.abs(cc0.c).toFixed(0) + "' the same way. Check the index error (on or off the arc) and the height of eye before using this fix.");
        }
      }
      if (S.length >= 3 && gapOk(zns)) { var cc = iterate(true); if (cc) { out.constErr = cc.c; out.fixC = cc.P; var d2 = offset(base.P, cc.P); out.cShift = Math.hypot(d2.dN, d2.dE); if (Math.abs(cc.c) > 1.5) warn.push("A constant altitude error of " + cc.c.toFixed(1) + "' fits the stars best: check the index error, dip and height of eye."); } }
      if (S.length === 3) {                                                            /* cocked hat: corners of the triangle of the three lines at the fix */
        var V = [], pr = [[0, 1], [1, 2], [0, 2]]; pr.forEach(function (p) { var a = base.L[p[0]], b = base.L[p[1]], u1 = [base.rows[p[0]][0], base.rows[p[0]][1]], u2 = [base.rows[p[1]][0], base.rows[p[1]][1]], det = u1[0] * u2[1] - u1[1] * u2[0]; if (Math.abs(det) > 1e-6) V.push([(a.a * u2[1] - b.a * u1[1]) / det, (u1[0] * b.a - u2[0] * a.a) / det]); });
        if (V.length === 3) { var mx = 0; [[0, 1], [1, 2], [0, 2]].forEach(function (q) { mx = Math.max(mx, Math.hypot(V[q[0]][0] - V[q[1]][0], V[q[0]][1] - V[q[1]][1])); }); out.hatNM = mx; }
      }
      if (inp.gps) { var g = offset(inp.gps, base.P); out.gpsErrNM = Math.hypot(g.dN, g.dE); out.gpsBrg = out.gpsErrNM < 0.005 ? null : (Math.atan2(g.dE, g.dN) / R + 360) % 360;   /* bearing from the GPS position to the celestial fix */ }
      return out;
    }
    /* One sight on its own: the position line through the DR, its intercept terminal point (ITP), and the longitude by
       chronometer (the longitude where the position line meets the DR latitude, solved exactly from the cosine formula).
       input as for fix() with one sight; the DR is taken at the time of the sight. */
    /* the Moon is reduced as seen from the observer; for the working these give the Almanac figures: geocentric LHA and Hc, and the
       parallax in altitude (geocentric Hc minus observer Hc) to add to Ho. The intercept is the same either way. */
    function geoMoon(row, p) { var g = Sight.reduce(p.lat, p.lon, row.gha, row.dec); row.hcGeo = g.hc; row.lhaGeo = g.lha; row.pa = (g.hc - row.hc) * 60; }
    function single(inp) {
      var s = inp.sights[0], warn = [], d = inp.dr, yr = new Date(s.ms).getUTCFullYear();
      if (!isFinite(s.ms) || yr < 2000 || yr > 2060) return { error: "The date is outside 2000 to 2060, which the star and Sun data cover.", warnings: warn };
      if (!isFinite(s.hs) || s.hs < 0 || s.hs > 90) return { error: "The sextant altitude is not a number between 0 and 90 degrees.", warnings: warn };
      if (!d || !isFinite(d.lat) || !isFinite(d.lon)) return { error: "The DR position is needed.", warnings: warn };
      if (Math.abs(d.lat) > 84) return { error: "Latitudes above 84 degrees are not supported.", warnings: warn };
      var ap = { lat: d.lat, lon: d.lon }, f = Sight.frame(s.ms), pl = Sight.place(s.ms, s.name, f);
      if (!pl) return { error: "Unknown body: " + s.name + ".", warnings: warn };
      var r = Sight.reduceBody(pl, ap.lat, ap.lon);
      var ho = Sight.ho({ hs: s.hs, ic: inp.ic, hoe: inp.hoe, temp: inp.temp, pres: inp.pres, body: pl.kind, limb: s.limb || "L", sd: pl.kind === "moon" ? r.sd : pl.sd, hp: pl.hp });
      if (ho.valid === false) return { error: s.name + ": the sextant altitude is below the horizon after the corrections (check the altitude, index error and height of eye).", warnings: warn };
      var a = (ho.ho - r.hc) * 60;
      if (Math.abs(a) > 180) return { error: "No position line. " + s.name + " is " + Math.abs(a).toFixed(0) + "' (" + (Math.abs(a) / 60).toFixed(1) + "°) away from where the DR puts it. This is almost always a wrong time (zone, hours or seconds), a wrong star or a wrong altitude. If the DR itself may be this far out, move the DR closer and try again.", warnings: warn };
      if (Math.abs(a) > 20) warn.push(s.name + ": intercept " + Math.abs(a).toFixed(1) + "' is large. Check the time, Hs and the DR.");
      if (r.hc < 5) warn.push(s.name + " is below 5 degrees: refraction is unreliable."); else if (r.hc < 10) warn.push(s.name + " is below 10 degrees: low altitude, less reliable."); if (r.hc > 80) warn.push(s.name + " is above 80 degrees: a straight line is a poor approximation.");
      var row = { name: s.name, kind: pl.kind, hp: pl.hp, ms: s.ms, ap: ap, gha: pl.gha, dec: pl.dec, lha: r.lha, hc: r.hc, zn: r.zn, ho: ho.ho, corr: ho, a: a };
      if (pl.kind === "moon") geoMoon(row, ap);
      var itp = move(ap, a * Math.cos(r.zn * R), a * Math.sin(r.zn * R));
      var out = { single: true, time: s.ms, sights: [row], itp: itp, lop: [(r.zn + 90) % 360, (r.zn + 270) % 360].sort(function (x, y) { return x - y; }), warnings: warn, lonChron: null };
      var off = Math.min(Math.abs(r.zn % 180), 180 - Math.abs(r.zn % 180));       /* degrees from north or south */
      /* solved from the cosine formula; the Moon's place depends on where the observer is (parallax), so for the Moon it is
         worked again at each new answer until it settles */
      var la = ap.lat, lo = ap.lon, loops = pl.kind === "moon" ? 8 : 1, k, ok = false;
      for (k = 0; k < loops; k++) {
        var rk = k === 0 ? r : Sight.reduceBody(pl, la, lo), g = pl.kind === "moon" ? { gha: rk.ghaTopo, dec: rk.decTopo } : pl;
        if (off < 30) {                                                               /* line runs nearly east-west: the latitude where it meets the DR longitude (Polaris, ex-meridian) */
          var A = Math.sin(g.dec * R), B = Math.cos(g.dec * R) * Math.cos(((g.gha + lo) % 360) * R), m = Math.hypot(A, B), q = Math.sin(ho.ho * R) / m;
          if (Math.abs(q) > 1) { ok = false; break; }
          var ph = Math.atan2(A, B), c1 = (ph + Math.acos(q)) / R, c2 = (ph - Math.acos(q)) / R;
          la = Math.abs(c1 - ap.lat) < Math.abs(c2 - ap.lat) ? c1 : c2; ok = true;
        } else {
          var cosH = (Math.sin(ho.ho * R) - Math.sin(ap.lat * R) * Math.sin(g.dec * R)) / (Math.cos(ap.lat * R) * Math.cos(g.dec * R));
          if (Math.abs(cosH) > 1) { ok = false; break; }
          var H = Math.acos(cosH) / R, lha = r.zn < 180 ? 360 - H : H;
          lo = (((lha - g.gha) % 360) + 540) % 360 - 180; ok = true; out.lhaChron = lha;
        }
      }
      if (ok && off < 30) out.latChron = la; else if (ok) out.lonChron = lo;
      return out;
    }
    return { fix: fix, single: single, advance: advance, drAt: drAt, offset: offset, move: move };
  })();
  /* SIGHTFIX-END */
