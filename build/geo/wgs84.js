  /* WGS84-BEGIN: rhumb line and geodesic on the WGS84 ellipsoid (the earth model used by GPS and ECDIS). Distances in NM of 1852 m. */
  var WGS84 = (function () {
    var a = 6378137, f = 1 / 298.257223563, b = a * (1 - f), e2 = f * (2 - f), e = Math.sqrt(e2), NM = 1852, R = Math.PI / 180;
    var n = f / (2 - f), n2 = n * n, n3 = n2 * n, n4 = n2 * n2;
    var A = a / (1 + n) * (1 + n2 / 4 + n4 / 64);                                     /* meridian arc, Helmert series (sub-millimetre) */
    var B1 = -3 / 2 * n + 9 / 16 * n3, B2 = 15 / 16 * n2 - 15 / 32 * n4, B3 = -35 / 48 * n3, B4 = 315 / 512 * n4;
    function arc(phi) { var p = phi * R; return A * (p + B1 * Math.sin(2 * p) + B2 * Math.sin(4 * p) + B3 * Math.sin(6 * p) + B4 * Math.sin(8 * p)); }   /* metres from the equator */
    function iso(phi) { var p = phi * R, s = Math.sin(p); return Math.log(Math.tan(Math.PI / 4 + p / 2)) - e / 2 * Math.log((1 + e * s) / (1 - e * s)); }  /* isometric latitude (meridional parts / 10800 x pi) */
    function n180(x) { return ((x % 360) + 540) % 360 - 180; }
    function rhumb(lat1, lon1, lat2, lon2) {                                            /* { course, dist } */
      var dl = n180(lon2 - lon1) * R, dpsi = iso(lat2) - iso(lat1), dm = arc(lat2) - arc(lat1);
      if (Math.abs(dl) < 1e-15 && Math.abs(dm) < 1e-6) return { course: null, dist: 0 };
      var c = Math.atan2(dl, dpsi), d;
      if (Math.abs(dpsi) > 1e-12) d = dm / Math.cos(c);
      else { var p = lat1 * R; d = Math.abs(dl) * a * Math.cos(p) / Math.sqrt(1 - e2 * Math.sin(p) * Math.sin(p)); }       /* along a parallel */
      return { course: (c / R + 360) % 360, dist: Math.abs(d) / NM };
    }
    function geodesic(lat1, lon1, lat2, lon2) {                                        /* Vincenty inverse: { dist, course, finalCourse } or null if it does not converge */
      var L = n180(lon2 - lon1) * R, U1 = Math.atan((1 - f) * Math.tan(lat1 * R)), U2 = Math.atan((1 - f) * Math.tan(lat2 * R));
      var sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2), lam = L, it = 0, sl, cl, ss, cs, sig, sa, c2a, c2m, C, lp;
      do {
        sl = Math.sin(lam); cl = Math.cos(lam);
        ss = Math.sqrt((cU2 * sl) * (cU2 * sl) + (cU1 * sU2 - sU1 * cU2 * cl) * (cU1 * sU2 - sU1 * cU2 * cl));
        if (ss === 0) return { dist: 0, course: null, finalCourse: null };
        cs = sU1 * sU2 + cU1 * cU2 * cl; sig = Math.atan2(ss, cs); sa = cU1 * cU2 * sl / ss; c2a = 1 - sa * sa;
        c2m = c2a !== 0 ? cs - 2 * sU1 * sU2 / c2a : 0;
        C = f / 16 * c2a * (4 + f * (4 - 3 * c2a)); lp = lam;
        lam = L + (1 - C) * f * sa * (sig + C * ss * (c2m + C * cs * (-1 + 2 * c2m * c2m)));
      } while (Math.abs(lam - lp) > 1e-12 && ++it < 200);
      if (it >= 200) return null;
      var u2 = c2a * (a * a - b * b) / (b * b), AA = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2))), BB = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
      var ds = BB * ss * (c2m + BB / 4 * (cs * (-1 + 2 * c2m * c2m) - BB / 6 * c2m * (-3 + 4 * ss * ss) * (-3 + 4 * c2m * c2m)));
      var s = b * AA * (sig - ds), a1 = Math.atan2(cU2 * sl, cU1 * sU2 - sU1 * cU2 * cl), a2 = Math.atan2(cU1 * sl, -sU1 * cU2 + cU1 * sU2 * cl);
      return { dist: s / NM, course: (a1 / R + 360) % 360, finalCourse: (a2 / R + 360) % 360 };
    }
    function latOfArc(m) {                                                             /* inverse of arc(): metres from the equator to latitude */
      var phi = m / A / R;
      for (var i = 0; i < 8; i++) { var s = Math.sin(phi * R), M = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5); phi += (m - arc(phi)) / (M * R); }
      return phi;
    }
    function dest(lat1, lon1, course, dist) {                                          /* rhumb line from a position: { lat, lon }, or null if it runs over a pole */
      var c = course * R, s = dist * NM, dm = s * Math.cos(c), m2 = arc(lat1) + dm, dl;
      if (Math.abs(m2) >= arc(90)) return null;
      var lat2 = Math.abs(dm) < 1e-9 ? lat1 : latOfArc(m2);
      if (Math.abs(dm) > 1) dl = Math.tan(c) * (iso(lat2) - iso(lat1));
      else { var p = (lat1 + lat2) / 2 * R, q = Math.sin(p); dl = s * Math.sin(c) * Math.sqrt(1 - e2 * q * q) / (a * Math.cos(p)); }      /* (nearly) along a parallel */
      return { lat: lat2, lon: n180(lon1 + dl / R) };
    }
    return { rhumb: rhumb, geodesic: geodesic, arc: arc, iso: iso, dest: dest };
  })();
  /* WGS84-END */
