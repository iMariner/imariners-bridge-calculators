  /* GEO-BEGIN */
  /* Position maths for the Special Areas map: parsing, formatting, point in area, distance to a boundary line */
  var Geo = (function () {
    var RAD = Math.PI / 180;
    function dm(v, pos, neg, lonStyle) {                         /* 48.45 -> 48°27.0'N ; longitude with three digits of degrees */
      var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 600) / 10;
      if (m >= 60) { d += 1; m = 0; }
      return (lonStyle ? ("00" + d).slice(-3) : ("0" + d).slice(-2)) + "°" + ("0" + m.toFixed(1)).slice(-4) + "'" + (v < 0 ? neg : pos);
    }
    function lat(v) { return dm(v, "N", "S", false); }
    function lon(v) { return dm(v, "E", "W", true); }
    function mercY(latDeg) { var l = Math.max(-85, Math.min(85, latDeg)); return Math.log(Math.tan(Math.PI / 4 + l * RAD / 2)) / RAD; }
    function invMercY(y) { return (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD; }
    function hms(d, m, s) { return (+d) + (m ? +m / 60 : 0) + (s ? +s / 3600 : 0); }
    function okLat(v) { return isFinite(v) && Math.abs(v) <= 90; }
    function okLon(v) { return isFinite(v) && Math.abs(v) <= 180; }
    function dms(d, m, s, hemi, maxDeg) {
      if (+d > maxDeg || (m !== undefined && m !== "" && +m >= 60) || (s !== undefined && s !== "" && +s >= 60)) return NaN;
      var v = hms(d, m, s); if (v > maxDeg) return NaN;
      return /[SW]/.test(hemi) ? -v : v;
    }
    /* Reads one line: optional name, then latitude and longitude. Returns {name, lat, lon} or {error}. */
    function parse(line) {
      var s = String(line || "").replace(/[°º˚]/g, " ").replace(/[′’‘`´']/g, " ").replace(/[″”“"]/g, " ").replace(/−|–/g, "-").replace(/,/g, " , ").replace(/\s+/g, " ").trim();
      if (!s) return { error: "empty" };
      var up = s.toUpperCase(), la = null, lo = null, name = "", m, cut = -1, end = -1;
      /* decimal pair without letters: 48.4583 -6.4167 / 48.4583, -6.4167 */
      if (!/[NSEW]/.test(up.replace(/^[^\d+-]*/, ""))) {
        m = /^(.*?)([+-]?\d{1,3}\.\d+|[+-]?\d{1,3})\s*,?\s*([+-]?\d{1,3}\.\d+|[+-]?\d{1,3})\s*$/.exec(up.replace(/ , /g, ","));
        if (!m) return { error: "no position found" };
        la = parseFloat(m[2]); lo = parseFloat(m[3]);
        if (!okLat(la) || !okLon(lo)) return { error: "latitude must be within 90 and longitude within 180" };
        return { name: s.slice(0, m[1].length).replace(/[\s,:;|=-]+$/, "").trim(), lat: la, lon: lo };
      }
      up = up.replace(/(\d)-(?=\d)/g, "$1 ");
      var NUM = "(\\d{1,3}(?:\\.\\d+)?)";
      var after = "(?:\\s+" + "(\\d{1,2}(?:\\.\\d+)?)" + "(?:\\s+(\\d{1,2}(?:\\.\\d+)?))?)?";
      var reA = new RegExp("(?:^|[\\s,;:=|(-])" + NUM + after + "\\s*([NSEW])(?![A-Z])", "g");            /* 48 27.5 N */
      var reB = new RegExp("(?:^|[\\s,;:=|(-])([NSEW])\\s*" + NUM + after + "(?![\\d.])", "g");            /* N 48 27.5 */
      var reC = new RegExp("(?:^|[\\s,;:=|(-])(\\d{2})(\\d{2}(?:\\.\\d+)?)\\s*([NS])(?![A-Z])|(?:^|[\\s,;:=|(-])(\\d{3})(\\d{2}(?:\\.\\d+)?)\\s*([EW])(?![A-Z])", "g"); /* 4827.5N 00625.0W */
      var found = [], r;
      function push(mm, d, mi, se, h, maxDeg, idx) { var v = dms(d, mi, se, h, maxDeg); found.push({ i: idx, hemi: h, v: v, text: mm[0], end: idx + mm[0].length }); }
      while ((r = reA.exec(up))) { var h = r[4]; push(r, r[1], r[2], r[3], h, /[NS]/.test(h) ? 90 : 180, r.index); }
      if (found.length < 2) { found = []; while ((r = reB.exec(up))) { var hb = r[1]; push(r, r[2], r[3], r[4], hb, /[NS]/.test(hb) ? 90 : 180, r.index); } }
      if (found.length < 2) { found = []; while ((r = reC.exec(up))) { if (r[3]) push(r, r[1], r[2], "", r[3], 90, r.index); else push(r, r[4], r[5], "", r[6], 180, r.index); } }
      if (found.length < 2) return { error: "need a latitude and a longitude, each ending in N, S, E or W" };
      var fLat = found.filter(function (f) { return /[NS]/.test(f.hemi); }), fLon = found.filter(function (f) { return /[EW]/.test(f.hemi); });
      if (fLat.length !== 1 || fLon.length !== 1) return { error: "give one latitude (N or S) and one longitude (E or W)" };
      if (isNaN(fLat[0].v) || isNaN(fLon[0].v)) return { error: "degrees or minutes out of range" };
      var first = Math.min(fLat[0].i, fLon[0].i);
      name = s.slice(0, first).replace(/[\s,:;|=(-]+$/, "").trim();
      return { name: name, lat: fLat[0].v, lon: fLon[0].v };
    }
    function pointInRing(x, y, ring) {                           /* ring: flat [lon, lat, lon, lat ...] already decoded */
      var inside = false, n = ring.length / 2;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        var xi = ring[2 * i], yi = ring[2 * i + 1], xj = ring[2 * j], yj = ring[2 * j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    function distSegNM(plat, plon, alat, alon, blat, blon) {     /* distance from a point to the segment AB, nautical miles, local flat frame at the point */
      var k = Math.cos(plat * RAD);
      function X(lo) { var d = lo - plon; if (d > 180) d -= 360; if (d < -180) d += 360; return d * k * 60; }
      var ax = X(alon), ay = (alat - plat) * 60, bx = X(blon), by = (blat - plat) * 60;
      var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
      var cx = ax + t * dx, cy = ay + t * dy;
      return Math.sqrt(cx * cx + cy * cy);
    }
    function gcNM(la1, lo1, la2, lo2) {
      var p1 = la1 * RAD, p2 = la2 * RAD, dp = p2 - p1, dl = (lo2 - lo1) * RAD, a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
    }
    function decode(arr) {                                       /* delta integers in 0.01 degree to [lon, lat, ...] */
      var out = new Array(arr.length), x = 0, y = 0;
      for (var i = 0; i < arr.length; i += 2) { x += arr[i]; y += arr[i + 1]; out[i] = x / 100; out[i + 1] = y / 100; }
      return out;
    }
    return { dm: dm, lat: lat, lon: lon, parse: parse, mercY: mercY, invMercY: invMercY, pointInRing: pointInRing, distSegNM: distSegNM, gcNM: gcNM, decode: decode };
  })();
  /* GEO-END */

