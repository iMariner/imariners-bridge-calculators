  /* SREPROUTE-BEGIN: route maths for Ship Reporting. Legs and boundary edges are rhumb lines on WGS84 (straight on a Mercator chart, as ECDIS draws them).
     Crossings are solved exactly in the (longitude, isometric latitude) plane; distances along a leg come from the meridian arc (WGS84 block). */
  var SRoute = (function () {
    var R = Math.PI / 180, E = Math.sqrt(1 / 298.257223563 * (2 - 1 / 298.257223563)), NM = 1852;
    function iso(lat) { return WGS84.iso(Math.max(-89.9, Math.min(89.9, lat))); }
    function invIso(psi) {                                         /* latitude from isometric latitude, fixed-point iteration (converges to 1e-12 in a few steps) */
      var p = 2 * Math.atan(Math.exp(psi)) - Math.PI / 2;
      for (var i = 0; i < 12; i++) { var s = E * Math.sin(p), q = 2 * Math.atan(Math.exp(psi) * Math.pow((1 + s) / (1 - s), E / 2)) - Math.PI / 2; if (Math.abs(q - p) < 1e-13) { p = q; break; } p = q; }
      return p / R;
    }
    function invArc(m) {                                           /* latitude from meridian arc in metres (Newton on WGS84.arc) */
      var p = m / 6367449.146 / R;
      for (var i = 0; i < 8; i++) { var f = WGS84.arc(p) - m, d = (WGS84.arc(p + 1e-6) - WGS84.arc(p - 1e-6)) / 2e-6; p -= f / d; if (Math.abs(f) < 1e-6) break; }
      return p;
    }
    function n180(x) { return ((x % 360) + 540) % 360 - 180; }

    /* waypoints [{lat, lon, name}] -> plan; longitudes are unwrapped so a leg never jumps across the date line */
    function plan(wps, startMs, speed) {
      var pts = [], legs = [], cum = 0, x = null;
      wps.forEach(function (w) { x = x === null ? w.lon : x + n180(w.lon - x); pts.push({ lat: w.lat, lon: n180(w.lon), x: x, y: iso(w.lat), m: WGS84.arc(w.lat), name: w.name || "" }); });
      for (var i = 0; i + 1 < pts.length; i++) {
        var a = pts[i], b = pts[i + 1], r = WGS84.rhumb(a.lat, a.lon, b.lat, b.lon);
        legs.push({ a: a, b: b, course: r.course, dist: r.dist, cum: cum }); cum += r.dist;
      }
      return { pts: pts, legs: legs, total: cum, startMs: startMs, speed: speed };
    }
    function onLeg(L, s) {                                         /* point at fraction s (0..1) of the leg's distance */
      var a = L.a, b = L.b, lat, x;
      if (Math.abs(b.m - a.m) < 1e-3) { lat = a.lat; x = a.x + s * (b.x - a.x); }
      else {
        lat = invArc(a.m + s * (b.m - a.m));
        x = Math.abs(b.y - a.y) < 1e-15 ? a.x : a.x + (b.x - a.x) * (iso(lat) - a.y) / (b.y - a.y);
      }
      return { lat: lat, lon: n180(x), x: x };
    }
    function atDist(P, d) {                                        /* position d NM from the start, with the course of that leg */
      if (!P.legs.length) { var p0 = P.pts[0]; return p0 ? { lat: p0.lat, lon: p0.lon, course: null, leg: -1, d: 0, before: d < 0, after: d > 0 } : null; }
      var dd = Math.max(0, Math.min(P.total, d)), i = 0;
      while (i < P.legs.length - 1 && dd > P.legs[i].cum + P.legs[i].dist) i++;
      var L = P.legs[i], s = L.dist > 0 ? (dd - L.cum) / L.dist : 0, q = onLeg(L, Math.max(0, Math.min(1, s)));
      return { lat: q.lat, lon: q.lon, x: q.x, course: L.course, leg: i, d: dd, before: d < 0, after: d > P.total + 1e-9 };
    }
    function timeAt(P, d) { return P.speed > 0 && isFinite(P.startMs) ? P.startMs + d / P.speed * 3600000 : null; }
    function at(P, ms) { return P.speed > 0 ? atDist(P, (ms - P.startMs) / 3600000 * P.speed) : atDist(P, 0); }

    /* region: list of rings, each a flat [lon, lat, lon, lat ...] array -> prepared rings in the Mercator plane */
    function prep(rings) {
      return rings.map(function (r) {
        var xs = [], ys = [], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (var i = 0; i < r.length; i += 2) { var x = r[i], y = iso(r[i + 1]); xs.push(x); ys.push(y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (xs.length > 1 && xs[0] === xs[xs.length - 1] && ys[0] === ys[ys.length - 1]) { xs.pop(); ys.pop(); }
        return { xs: xs, ys: ys, b: [x0, y0, x1, y1] };
      });
    }
    function inRing(g, x, y) {
      var inside = false, xs = g.xs, ys = g.ys, n = xs.length;
      for (var i = 0, j = n - 1; i < n; j = i++) if ((ys[i] > y) !== (ys[j] > y) && x < (xs[j] - xs[i]) * (y - ys[i]) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
      return inside;
    }
    function shifts(g, x) { var o = []; [-360, 0, 360].forEach(function (k) { if (x >= g.b[0] + k - 1e-9 && x <= g.b[2] + k + 1e-9) o.push(k); }); return o; }
    function inside(G, lat, lon) {
      var y = iso(lat);
      for (var r = 0; r < G.length; r++) { var g = G[r], ks = shifts(g, lon); for (var k = 0; k < ks.length; k++) if (inRing(g, lon - ks[k], y)) return true; }
      return false;
    }
    /* every place the route crosses the region's edge, in order: { d, lat, lon, leg, kind: "entry" | "exit" } */
    function cross(P, G) {
      if (!P.pts.length) return { events: [], startInside: false, endInside: false };
      var hits = [];
      P.legs.forEach(function (L, li) {
        var ax = L.a.x, ay = L.a.y, bx = L.b.x, by = L.b.y, lx0 = Math.min(ax, bx), lx1 = Math.max(ax, bx), ly0 = Math.min(ay, by), ly1 = Math.max(ay, by);
        G.forEach(function (g, gi) {
          [-360, 0, 360].forEach(function (k) {
            if (g.b[2] + k < lx0 || g.b[0] + k > lx1 || g.b[3] < ly0 || g.b[1] > ly1) return;
            var xs = g.xs, ys = g.ys, n = xs.length;
            for (var i = 0; i < n; i++) {
              var cx = xs[i] + k, cy = ys[i], dx2 = xs[(i + 1) % n] + k, dy2 = ys[(i + 1) % n];
              if (Math.max(cx, dx2) < lx0 || Math.min(cx, dx2) > lx1 || Math.max(cy, dy2) < ly0 || Math.min(cy, dy2) > ly1) continue;
              var rx = bx - ax, ry = by - ay, sx = dx2 - cx, sy = dy2 - cy, den = rx * sy - ry * sx;
              if (Math.abs(den) < 1e-18) continue;
              var u = ((cx - ax) * sy - (cy - ay) * sx) / den, v = ((cx - ax) * ry - (cy - ay) * rx) / den;
              if (u < 0 || u > 1 || v < 0 || v >= 1) continue;      /* v in [0,1): a crossing exactly at a ring vertex is counted once */
              var y = ay + u * ry, lat = Math.abs(ry) < 1e-15 ? L.a.lat : invIso(y), x = ax + u * rx, s;
              if (Math.abs(L.b.m - L.a.m) > 1e-3) s = (WGS84.arc(lat) - L.a.m) / (L.b.m - L.a.m); else s = u;
              hits.push({ d: L.cum + Math.max(0, Math.min(1, s)) * L.dist, lat: lat, lon: n180(x), x: x - k, leg: li, ring: gi });
            }
          });
        });
      });
      hits.sort(function (p, q) { return p.d - q.d; });
      var p0 = P.pts[0], state = G.map(function (g) { return inside([g], p0.lat, p0.lon); }), any = function () { for (var i = 0; i < state.length; i++) if (state[i]) return true; return false; };
      var startInside = any(), was = startInside, events = [];
      for (var i = 0; i < hits.length; ) {                         /* hits at the same place (a region cut at the date line, two rings touching) are taken together */
        var j = i, h = hits[i];
        while (j < hits.length && hits[j].d - h.d < 1e-6) { state[hits[j].ring] = !state[hits[j].ring]; j++; }
        var now = any();
        if (now !== was) { events.push({ d: h.d, lat: h.lat, lon: h.lon, x: h.x, leg: h.leg, kind: now ? "entry" : "exit" }); was = now; }
        i = j;
      }
      return { events: events, startInside: startInside, endInside: was };
    }
    /* a circle of radius r NM around a point, as one ring (rhumb chords of 2 degrees of bearing: within 0.02% of r) */
    function circle(lat, lon, rNM) {
      var out = [];
      for (var b = 0; b < 360; b += 2) {
        var dm = rNM * NM * Math.cos(b * R), la = invArc(WGS84.arc(lat) + dm), dpsi = iso(la) - iso(lat), lo;
        if (Math.abs(dpsi) > 1e-12) lo = lon + Math.tan(b * R) * dpsi / R;
        else { var p = lat * R; lo = lon + rNM * NM * Math.sin(b * R) * Math.sqrt(1 - E * E * Math.sin(p) * Math.sin(p)) / (6378137 * Math.cos(p)) / R; }
        out.push(lo, la);
      }
      return out;
    }
    return { plan: plan, atDist: atDist, at: at, timeAt: timeAt, prep: prep, inside: inside, cross: cross, circle: circle, invIso: invIso, iso: iso, n180: n180 };
  })();
  /* SREPROUTE-END */
