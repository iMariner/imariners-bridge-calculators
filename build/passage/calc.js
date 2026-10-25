  /* PASSAGE-BEGIN */
  /* Passage plan legs: rhumb line (Mercator sailing, uses courseMadeGood), great circle and composite great circle.
     Great circle on a sphere, distances in NM = arc minutes (the usual nautical practice). Positions { lat, lon }: degrees, North and East +.
     A great circle leg is sailed as rhumb lines between waypoints on chosen meridians; both the great circle distance and
     the distance actually sailed along those rhumb lines are given. */
  var Passage = (function () {
    var R = Math.PI / 180;
    function n180(x) { return ((x % 360) + 540) % 360 - 180; }
    function vec(p) { var a = p.lat * R, b = p.lon * R; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; }
    function pt(v) { var n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return { lat: Math.asin(Math.max(-1, Math.min(1, v[2] / n))) / R, lon: Math.atan2(v[1], v[0]) / R }; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function ang(a, b) { return Math.atan2(Math.sqrt(dot(cross(a, b), cross(a, b))), dot(a, b)) / R; }      /* degrees, stable for small and near-180 angles */
    function dist(p1, p2) { return ang(vec(p1), vec(p2)) * 60; }
    function course(p1, p2) {                                                          /* initial great circle course, degrees true */
      var f1 = p1.lat * R, f2 = p2.lat * R, dl = n180(p2.lon - p1.lon) * R;
      var c = Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) / R;
      return (c + 360) % 360;
    }
    function rhumb(p1, p2) { var r = courseMadeGood(p1.lat, p1.lon, p2.lat, p2.lon, null); return { course: r.course, dist: r.dist }; }
    function vertexOn(p1, p2) {                                                        /* the vertex (highest latitude) if it lies between p1 and p2 */
      var a = vec(p1), b = vec(p2), n = cross(a, b), m = Math.sqrt(dot(n, n)); if (m < 1e-12) return null;
      n = [n[0] / m, n[1] / m, n[2] / m];
      var v = [-n[2] * n[0], -n[2] * n[1], 1 - n[2] * n[2]], d = ang(a, b), best = null;
      [v, [-v[0], -v[1], -v[2]]].forEach(function (c) { if (Math.sqrt(dot(c, c)) < 1e-12) return; if (Math.abs(ang(a, c) + ang(c, b) - d) < 1e-6) best = pt(c); });
      return best;
    }
    function latAtLon(p1, p2, lon) {                                                   /* latitude where the great circle p1-p2 crosses a meridian */
      var f1 = p1.lat * R, f2 = p2.lat * R, l1 = p1.lon * R, l2 = l1 + n180(p2.lon - p1.lon) * R, l = lon * R;
      return Math.atan((Math.tan(f1) * Math.sin(l2 - l) + Math.tan(f2) * Math.sin(l - l1)) / Math.sin(l2 - l1)) / R;
    }
    function slerp(p1, p2, f) { var a = vec(p1), b = vec(p2), w = ang(a, b) * R, s = Math.sin(w); if (s < 1e-12) return { lat: p1.lat, lon: p1.lon }; var k1 = Math.sin((1 - f) * w) / s, k2 = Math.sin(f * w) / s; return pt([k1 * a[0] + k2 * b[0], k1 * a[1] + k2 * b[1], k1 * a[2] + k2 * b[2]]); }
    function gcPoints(p1, p2, step) {                                                  /* waypoints on round meridians every `step` degrees of longitude, ends excluded */
      var dl = n180(p2.lon - p1.lon), out = [];
      if (Math.abs(dl) < 1e-9 || Math.abs(Math.abs(dl) - 180) < 1) {                   /* along a meridian or over a pole: equal distances instead */
        var d = dist(p1, p2), n = Math.floor(d / (step * 60)); for (var j = 1; j <= n; j++) { if (j * step * 60 < d - 1) out.push(slerp(p1, p2, j * step * 60 / d)); } return out;
      }
      var s = dl > 0 ? 1 : -1, k = s > 0 ? Math.floor(p1.lon / step) + 1 : Math.ceil(p1.lon / step) - 1;
      for (var lon = k * step; s * (lon - (p1.lon + dl)) < -1e-9; lon += s * step) { if (Math.abs(lon - p1.lon) < 1e-9) continue; out.push({ lat: latAtLon(p1, p2, lon), lon: n180(lon) }); }
      return out;
    }
    /* one leg. opt: { type: "RL" | "GC", step (deg of longitude, default 5), limit (limiting latitude, degrees, or null) } */
    function leg(p1, p2, opt) {
      opt = opt || {}; var step = opt.step || 5, rl = rhumb(p1, p2), out = { type: "RL", from: p1, to: p2, rlDist: rl.dist, warnings: [] };
      if (opt.type !== "GC" || rl.dist < 1e-6) { out.course = rl.course; out.dist = rl.dist; out.sailed = rl.dist; out.points = [p1, p2]; out.subs = [{ from: p1, to: p2, course: rl.course, dist: rl.dist }]; return out; }
      var vx = vertexOn(p1, p2), pts, lim = opt.limit;
      out.type = "GC"; out.gcDist = dist(p1, p2); out.course = course(p1, p2); out.finalCourse = (course(p2, p1) + 180) % 360; out.vertex = vx;
      if (lim && vx && Math.abs(vx.lat) > lim) {
        var sg = vx.lat > 0 ? 1 : -1, fL = sg * lim, dl = n180(p2.lon - p1.lon), s = dl > 0 ? 1 : -1;
        if (sg * p1.lat >= lim || sg * p2.lat >= lim) { out.warnings.push("A position is beyond the limiting latitude: plain great circle used."); }
        else {
          var d1 = Math.acos(Math.tan(p1.lat * R) / Math.tan(fL * R)) / R, d2 = Math.acos(Math.tan(p2.lat * R) / Math.tan(fL * R)) / R;
          if (d1 + d2 < Math.abs(dl)) {
            var V1 = { lat: fL, lon: n180(p1.lon + s * d1) }, V2 = { lat: fL, lon: n180(p2.lon - s * d2) }, par = (Math.abs(dl) - d1 - d2) * 60 * Math.cos(fL * R);
            out.type = "CGC"; out.V1 = V1; out.V2 = V2; out.gc1 = dist(p1, V1); out.gc2 = dist(V2, p2); out.parallel = par; out.gcDist = out.gc1 + par + out.gc2;
            out.course = course(p1, V1); out.finalCourse = (course(p2, V2) + 180) % 360; out.vertex = null;
            var par1 = [], k = s > 0 ? Math.floor(V1.lon / step) + 1 : Math.ceil(V1.lon / step) - 1, end = V1.lon + s * (Math.abs(dl) - d1 - d2);
            for (var lon = k * step; s * (lon - end) < -1e-9; lon += s * step) par1.push({ lat: fL, lon: n180(lon) });
            pts = [p1].concat(gcPoints(p1, V1, step), [V1], par1, [V2], gcPoints(V2, p2, step), [p2]);
          }
        }
      }
      if (!pts) pts = [p1].concat(gcPoints(p1, p2, step), [p2]);
      out.points = pts; out.subs = []; out.sailed = 0;
      for (var i = 1; i < pts.length; i++) { var r = rhumb(pts[i - 1], pts[i]); if (r.dist < 0.05) continue; out.subs.push({ from: pts[i - 1], to: pts[i], course: r.course, dist: r.dist }); out.sailed += r.dist; }
      out.dist = out.sailed; out.saving = out.rlDist - out.sailed;
      var hi = 0; pts.forEach(function (p) { hi = Math.max(hi, Math.abs(p.lat)); }); if (hi > 70) out.warnings.push("The track reaches " + Math.round(hi) + "° of latitude: check ice and weather, or set a limiting latitude.");
      return out;
    }
    return { leg: leg, dist: dist, course: course, vertexOn: vertexOn, rhumb: rhumb };
  })();
  /* PASSAGE-END */
