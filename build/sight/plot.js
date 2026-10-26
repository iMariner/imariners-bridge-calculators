  /* SIGHTPLOT-BEGIN */
  /* The plotting sheet: DR track, each line of position (dashed where the sight was taken, solid carried to the fix time),
     the fix, GPS, scale bar, compass rose, latitude and longitude ticks. Returns SVG markup. Needs SightFix. */
  var SightPlot = (function () {
    var R = Math.PI / 180, NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600];
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
    function nice(v) { for (var i = 0; i < NICE.length; i++) if (NICE[i] >= v) return NICE[i]; return NICE[NICE.length - 1]; }
    function tickText(deg, stepMin, pos, neg, w) {
      var a = Math.abs(deg), M = Math.round(a * 600) / 10, d = Math.floor(M / 60 + 1e-9), m = M - d * 60;
      if (m >= 59.95) { d++; m = 0; }
      var ds = String(d); while (ds.length < w) ds = "0" + ds;
      return ds + "°" + (stepMin < 1 ? m.toFixed(1) : String(Math.round(m))) + "'" + (deg < 0 ? neg : pos);
    }
    function clip(x0, y0, dx, dy, L, T, Rr, B) {                                   /* Liang-Barsky: line x0+t*dx, any t, inside the box */
      var t0 = -1e9, t1 = 1e9, p = [-dx, dx, -dy, dy], q = [x0 - L, Rr - x0, y0 - T, B - y0];
      for (var i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] < 0) return null; }
        else { var t = q[i] / p[i]; if (p[i] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); }
      }
      return t0 < t1 ? [t0, t1] : null;
    }
    function meet(a, b) {                                                           /* two lines point + direction */
      var den = a.dx * b.dy - a.dy * b.dx; if (Math.abs(den) < 1e-9) return null;
      var t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / den; return { x: a.x + t * a.dx, y: a.y + t * a.dy };
    }
    /* the plotting geometry in nautical miles (x east, y north) around the fix: for each sight the assumed position (ap), the
       intercept terminal point (f0, the position line at the time of the sight passes through it at 90 deg to the azimuth) and the
       same line carried to the fix time (f1); dx, dy is the direction of the position line. Exposed for the geometry test. */
    function geom(r, inp) {
      var fx = r.fix, drF = r.dr || SightFix.drAt(inp.dr, r.time), cosF = Math.cos(fx.lat * R);
      function pl(p) { var dl = p.lon - fx.lon; dl -= 360 * Math.round(dl / 360); return { x: dl * 60 * cosF, y: (p.lat - fx.lat) * 60 }; }
      var pts = [{ x: 0, y: 0 }], dF = pl(drF); pts.push(dF);
      var L = r.sights.map(function (s) {
        var ap = pl(s.ap), z = s.zn * R, lat = s.name === "Latitude";
        var af = lat ? s.a + dF.y : (s.ho - s.hcFix) * 60;             /* line as seen from the fix: intercept worked from the fix itself */
        var f1p = lat ? { x: 0, y: af } : { x: af * Math.sin(z), y: af * Math.cos(z) };
        /* as plotted by hand: from the assumed position lay off the intercept along the azimuth (towards or away), and draw the
           position line at right angles through that point (the intercept terminal point) */
        var f0 = lat ? { x: ap.x, y: ap.y + s.a } : { x: ap.x + s.a * Math.sin(z), y: ap.y + s.a * Math.cos(z) };
        pts.push(ap, f0, f1p);
        return { s: s, ap: ap, f0: f0, f1: f1p, dx: Math.cos(z), dy: -Math.sin(z) };
      });
      return { fx: fx, cosF: cosF, pl: pl, pts: pts, dF: dF, L: L };
    }
    /* opt.single: one position line. r.fix is then the ITP; opt.mark = { lat, lon, label } is the longitude by chronometer (or latitude) point */
    function build(r, inp, W, H, id, opt) {
      opt = opt || {};
      var G = geom(r, inp), fx = G.fx, cosF = G.cosF, pl = G.pl, pts = G.pts, dF = G.dF, L = G.L;
      for (var ii = 0; ii < L.length; ii++) for (var jj = ii + 1; jj < L.length; jj++) {    /* every crossing of the lines, so the whole figure is in view */
        var mx = meet({ x: L[ii].f1.x, y: L[ii].f1.y, dx: L[ii].dx, dy: L[ii].dy }, { x: L[jj].f1.x, y: L[jj].f1.y, dx: L[jj].dx, dy: L[jj].dy });
        if (mx && Math.hypot(mx.x, mx.y) < 40) pts.push(mx);
      }
      var gps = inp.gps ? pl(inp.gps) : null; if (gps) pts.push(gps);
      var mk = opt.mark ? pl(opt.mark) : null; if (mk) pts.push(mk);
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      var padv = Math.max(0.15 * Math.max(x1 - x0, y1 - y0), 1.2); x0 -= padv; x1 += padv; y0 -= padv; y1 += padv;
      var ml = 74, mr = 16, mt = 14, mb = 34, aw = W - ml - mr, ah = H - mt - mb, sc = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ox = ml + aw / 2 - cx * sc, oy = mt + ah / 2 + cy * sc;
      function X(x) { return ox + x * sc; } function Y(y) { return oy - y * sc; }
      var left = ml, top = mt, right = ml + aw, bottom = mt + ah, o = [];
      var vx0 = (left - ox) / sc, vx1 = (right - ox) / sc, vy0 = (oy - bottom) / sc, vy1 = (oy - top) / sc;
      o.push('<defs><marker id="' + id + 'a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="sp-arrow" d="M0 0 L10 5 L0 10 z"/></marker><clipPath id="' + id + '"><rect x="' + left + '" y="' + top + '" width="' + aw + '" height="' + ah + '"/></clipPath></defs>');
      o.push('<rect class="sp-bg" x="' + left + '" y="' + top + '" width="' + aw + '" height="' + ah + '"/>');
      /* ticks and grid */
      var stepLat = nice(70 / sc), k, v;
      for (k = Math.ceil((fx.lat * 60 + vy0) / stepLat); k <= Math.floor((fx.lat * 60 + vy1) / stepLat); k++) {
        var yy = Y(k * stepLat - fx.lat * 60);
        o.push('<line class="sp-grid" x1="' + left + '" x2="' + right + '" y1="' + f1(yy) + '" y2="' + f1(yy) + '"/><text class="sp-tick" x="' + (left - 5) + '" y="' + f1(yy + 3) + '" text-anchor="end">' + tickText(k * stepLat / 60, stepLat, "N", "S", 2) + '</text>');
      }
      var stepLon = nice(70 / sc / cosF);
      for (k = Math.ceil((fx.lon * 60 + vx0 / cosF) / stepLon); k <= Math.floor((fx.lon * 60 + vx1 / cosF) / stepLon); k++) {
        var xx = X((k * stepLon - fx.lon * 60) * cosF), lv = k * stepLon / 60; lv = ((lv + 540) % 360) - 180;
        o.push('<line class="sp-grid" y1="' + top + '" y2="' + bottom + '" x1="' + f1(xx) + '" x2="' + f1(xx) + '"/><text class="sp-tick" x="' + f1(xx) + '" y="' + (bottom + 14) + '" text-anchor="middle">' + tickText(lv, stepLon, "E", "W", 3) + '</text>');
      }
      o.push('<rect class="sp-frame" x="' + left + '" y="' + top + '" width="' + aw + '" height="' + ah + '"/>');
      o.push('<g clip-path="url(#' + id + ')">');
      /* cocked hat */
      var adv = L.slice().sort(function (a, b) { return a.s.zn - b.s.zn; }).map(function (l) { return { x: l.f1.x, y: l.f1.y, dx: l.dx, dy: l.dy }; });
      if (L.length >= 3) {
        var hat = [], okh = true; for (k = 0; k < adv.length; k++) { var m = meet(adv[k], adv[(k + 1) % adv.length]); if (!m) { okh = false; break; } hat.push(m); }
        if (okh) o.push('<polygon class="sp-hat" points="' + hat.map(function (p) { return f1(X(p.x)) + "," + f1(Y(p.y)); }).join(" ") + '"/>');
      }
      /* drawn the chartwork way (Admiralty practice): a position line has one arrowhead at each end, a transferred position line
         two, the ship's run (ground track) two arrowheads along it. Each line carries its number, body, time and direction, each
         azimuth its Zn, each intercept its length; a compass rose shows the azimuth of every body. opt.zone gives ship's time. */
      var zone = opt.zone === undefined || opt.zone === null ? 0 : opt.zone, labels = [], fixed = [];
      function hm(ms) { var t = Math.round(ms / 60000 + zone * 60), m = ((t % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ("0" + (m % 60)).slice(-2); }
      function p3(d) { d = ((Math.round(d) % 360) + 360) % 360; return ("00" + d).slice(-3); }
      function heads(x, y, ux, uy, n, col) {                                        /* n arrowheads, tip at x, y, pointing along ux, uy (screen) */
        var s = "";
        for (var h = 0; h < n; h++) { var tx = x - ux * h * 8, ty = y - uy * h * 8, bx = tx - ux * 10, by = ty - uy * 10;
          s += '<path class="sp-head ' + col + '" d="M' + f1(tx) + ' ' + f1(ty) + ' L' + f1(bx - uy * 4.5) + ' ' + f1(by + ux * 4.5) + ' L' + f1(bx + uy * 4.5) + ' ' + f1(by - ux * 4.5) + ' z"/>'; }
        return s;
      }
      function across(p, l, cls, col, n) {                                          /* the line through p across the view, n arrowheads at each end */
        var px = X(p.x), py = Y(p.y), ddx = l.dx * sc, ddy = -l.dy * sc, c = clip(px, py, ddx, ddy, left + 4, top + 4, right - 4, bottom - 4);
        if (!c) return null;
        var ax = px + ddx * c[0], ay = py + ddy * c[0], bx = px + ddx * c[1], by = py + ddy * c[1], ln = Math.hypot(bx - ax, by - ay); if (ln < 1) return null;
        var ux = (bx - ax) / ln, uy = (by - ay) / ln;
        o.push('<line class="' + cls + ' ' + col + '" x1="' + f1(ax) + '" y1="' + f1(ay) + '" x2="' + f1(bx) + '" y2="' + f1(by) + '"/>');
        if (n) o.push(heads(bx, by, ux, uy, n, col) + heads(ax, ay, -ux, -uy, n, col));
        return { x: px, y: py, dx: ddx, dy: ddy, t0: c[0], t1: c[1] };
      }
      function clash(b) { return labels.concat(fixed).some(function (o) { return !(b[2] < o.b[0] || b[0] > o.b[2] || b[3] < o.b[1] || b[1] > o.b[3]); }); }
      function box(x, y, end, txt) { var w = txt.length * 6.7 + 4, bx = end === "start" ? x : end === "end" ? x - w : x - w / 2; return [bx, y - 16, bx + w, y - 1]; }
      function along(g, txt, cls, fr) {                                             /* a label on a line: try spots along it until it clashes with no other */
        if (!g) return; var best = null;
        for (var q = 0; q < fr.length; q++) {
          var t = g.t0 + fr[q] * (g.t1 - g.t0) * 0.86 + 0.07 * (g.t1 - g.t0), lx = g.x + g.dx * t, ly = g.y + g.dy * t, end = lx < (left + right) / 2 ? "start" : "end";
          var cand = { x: lx + (end === "start" ? 4 : -4), y: ly, end: end, txt: txt, cls: cls }; cand.b = box(cand.x, ly, end, txt);
          if (cand.b[0] < left || cand.b[2] > right || cand.b[1] < top) continue;
          if (!best) best = cand; if (!clash(cand.b)) { best = cand; break; }
        }
        if (best) labels.push(best);
      }
      function at(x, y, end, txt, cls) {                                            /* a label at a point, kept inside the frame */
        var b = { x: x, y: Math.min(Math.max(y, top + 16), bottom - 3), end: end, txt: txt, cls: cls }; b.b = box(b.x, b.y, end, txt);
        if (b.b[2] > right - 3) { b.end = "end"; b.x = Math.min(x, right - 3); } else if (b.b[0] < left + 3) { b.end = "start"; b.x = Math.max(x, left + 3); }
        b.b = box(b.x, b.y, b.end, txt); fixed.push(b);
      }
      /* the compass rose goes in the emptiest corner (scale bar bottom right) */
      var rr = Math.max(44, Math.min(aw, ah) * 0.12), rose = null, rbest = 1e9;
      [[left + rr + 34, top + rr + 22], [right - rr - 34, top + rr + 22], [left + rr + 34, bottom - rr - 22]].forEach(function (cd) {
        var sco = 0;
        pts.forEach(function (p) { if (Math.hypot(X(p.x) - cd[0], Y(p.y) - cd[1]) < rr + 14) sco += 3; });
        L.forEach(function (l) { var qx = X(l.f1.x) - cd[0], qy = Y(l.f1.y) - cd[1]; if (Math.abs(qx * -l.dy - qy * l.dx) < rr + 6) sco++; });
        if (sco < rbest) { rbest = sco; rose = cd; }
      });
      if (opt.rose === false) rose = null;
      if (rose) fixed.push({ b: [rose[0] - rr - 30, rose[1] - rr - 18, rose[0] + rr + 30, rose[1] + rr + 18] });
      /* ship's run between the sights: the ground track, two arrowheads */
      var runNM = Math.hypot(dF.x - L[0].ap.x, dF.y - L[0].ap.y), first = L[0].ap;
      var tmin = L[0].s.ms; for (k = 1; k < L.length; k++) if (L[k].s.ms < tmin) { tmin = L[k].s.ms; first = L[k].ap; }
      runNM = Math.hypot(dF.x - first.x, dF.y - first.y);
      var trackG = null;
      if (runNM > 0.3 && !opt.clean) {
        var t0x = X(first.x), t0y = Y(first.y), t1x = X(dF.x), t1y = Y(dF.y), tl = Math.hypot(t1x - t0x, t1y - t0y);
        o.push('<line class="sp-track" x1="' + f1(t0x) + '" y1="' + f1(t0y) + '" x2="' + f1(t1x) + '" y2="' + f1(t1y) + '"/>');
        if (tl > 40) { var tux = (t1x - t0x) / tl, tuy = (t1y - t0y) / tl; o.push(heads(t0x + tux * (tl * 0.5 + 9), t0y + tuy * (tl * 0.5 + 9), tux, tuy, 2, "sp-trk")); }
        trackG = { x: t0x, y: t0y, dx: t1x - t0x, dy: t1y - t0y, t0: 0, t1: 1, txt: "Run " + p3(Math.atan2(dF.x - first.x, dF.y - first.y) / R) + "° " + f1(runNM) + " NM" };
      }
      /* fixed labels first, so the line labels keep clear of them */
      if (gps) at(X(gps.x) + 9, Y(gps.y) + 4, "start", "GPS", "sp-lab");
      at(X(0) + 11, Y(0) - 9, "start", opt.single ? "ITP" : "FIX " + hm(r.time), "sp-lab sp-fixlab");
      if (mk) at(X(mk.x) + 10, Y(mk.y) + 16, "start", opt.mark.label, "sp-lab");
      if (!opt.single) at(X(dF.x) + 7, Y(dF.y) + 15, "start", "DR " + hm(r.time), "sp-lab sp-drlab");
      var fin = [], before = [];
      L.forEach(function (l, i) {
        var s = l.s, col = "sp-c" + (i % 4), isLat = s.name === "Latitude", moved = !opt.single && Math.abs(s.ms - r.time) > 60000 && runNM > 0.3;
        var a = (((s.zn + 90) % 180) + 180) % 180, dir = p3(a) + "°/" + p3(a + 180) + "°", nm = isLat ? "Lat" : s.name;
        var gap = Math.abs((l.f0.x - l.f1.x) * l.dy - (l.f0.y - l.f1.y) * l.dx) * sc;    /* a line moved only a few minutes lies on itself: draw it once */
        if (moved && !opt.clean && gap > 10) before.push([across(l.f0, l, "sp-lop0", col, 1), (i + 1) + " " + nm + " " + hm(s.ms), "sp-lab sp-lab0 " + col]);
        if (!opt.single && !opt.clean && !isLat) {                                  /* the construction: azimuth from the AP, intercept, right angle */
          var zr = s.zn * R, ux = Math.sin(zr), uy = Math.cos(zr), len = Math.max(Math.abs(s.a) + 14 / sc, 34 / sc);
          var cz = clip(X(l.ap.x), Y(l.ap.y), ux, -uy, left + 34, top + 22, right - 34, bottom - 22); if (cz && cz[1] > 0) len = Math.min(len, Math.max(cz[1], 12) / sc);   /* keep the arrow and its Zn inside the frame */
          var ex = X(l.ap.x + ux * len), ey = Y(l.ap.y + uy * len);
          o.push('<line class="sp-azl ' + col + '" x1="' + f1(X(l.ap.x)) + '" y1="' + f1(Y(l.ap.y)) + '" x2="' + f1(ex) + '" y2="' + f1(ey) + '"/>' + heads(ex, ey, ux, -uy, 1, col));
          at(ex + ux * 6 + (ux >= 0 ? 2 : -2), ey - uy * 6 + 4, ux >= 0 ? "start" : "end", "Zn " + p3(s.zn) + "°", "sp-lab sp-labz " + col);
          o.push('<line class="sp-icpt ' + col + '" x1="' + f1(X(l.ap.x)) + '" y1="' + f1(Y(l.ap.y)) + '" x2="' + f1(X(l.f0.x)) + '" y2="' + f1(Y(l.f0.y)) + '"/>');
          if (Math.abs(s.a) * sc > 26) { var mx2 = (X(l.ap.x) + X(l.f0.x)) / 2 + uy * 9, my2 = (Y(l.ap.y) + Y(l.f0.y)) / 2 + ux * 9 + 4; at(mx2, my2, uy >= 0 ? "start" : "end", f1(Math.abs(s.a)) + "' " + (s.a >= 0 ? "T" : "A"), "sp-lab sp-labi " + col); }
          var e = 6 / sc, sg = s.a >= 0 ? -1 : 1, bx0 = l.f0.x + sg * ux * e, by0 = l.f0.y + sg * uy * e;            /* small square at the ITP */
          if (Math.abs(s.a) * sc > 8) o.push('<path class="sp-rt" d="M' + f1(X(bx0)) + ' ' + f1(Y(by0)) + ' L' + f1(X(bx0 + l.dx * e)) + ' ' + f1(Y(by0 + l.dy * e)) + ' L' + f1(X(l.f0.x + l.dx * e)) + ' ' + f1(Y(l.f0.y + l.dy * e)) + '"/>');
          o.push('<circle class="sp-foot" cx="' + f1(X(l.f0.x)) + '" cy="' + f1(Y(l.f0.y)) + '" r="2"/>');
        }
        if (!opt.clean) o.push('<circle class="sp-ap" cx="' + f1(X(l.ap.x)) + '" cy="' + f1(Y(l.ap.y)) + '" r="3"/>');
        if (!opt.single && !opt.clean && runNM > 0.3 && !isLat) {                   /* number the ship's DR at each sight, as written in the sight book */
          var dq = s.drSight ? pl(s.drSight) : l.ap;
          o.push('<circle class="sp-ap" cx="' + f1(X(dq.x)) + '" cy="' + f1(Y(dq.y)) + '" r="3"/><text class="sp-lab sp-halo" x="' + f1(X(dq.x) - 7) + '" y="' + f1(Y(dq.y) + 4) + '" text-anchor="end">' + (i + 1) + '</text>');
        }
        fin.push([across(l.f1, l, "sp-lop", col, moved ? 2 : 1), (i + 1) + " " + nm + " " + hm(s.ms) + (moved ? "→" + hm(r.time) : "") + "  " + dir, "sp-lab " + col]);
      });
      fin.forEach(function (f) { along(f[0], f[1], f[2], [0.05, 0.95, 0.25, 0.75, 0.5, 0.15, 0.85, 0.4, 0.6]); });
      before.forEach(function (f) { along(f[0], f[1], f[2], [0.95, 0.05, 0.75, 0.25, 0.85, 0.15, 0.5]); });
      if (trackG) along(trackG, trackG.txt, "sp-lab sp-labt", [0.3, 0.7, 0.2, 0.8]);
      /* fix, GPS */
      if (gps) o.push('<path class="sp-gps" d="M' + f1(X(gps.x)) + ' ' + f1(Y(gps.y) - 6) + ' l6 6 l-6 6 l-6 -6 z"/>');
      o.push('<circle class="sp-dr" cx="' + f1(X(dF.x)) + '" cy="' + f1(Y(dF.y)) + '" r="3.5"/>');
      if (opt.single) {                                                               /* intercept from the DR to the ITP, and the direction of the body */
        var s0 = L[0].s, zr0 = s0.zn * R, al = 40 / sc, ax0 = X(dF.x + al * Math.sin(zr0)), ay0 = Y(dF.y + al * Math.cos(zr0));
        o.push('<line class="sp-int" x1="' + f1(X(dF.x)) + '" y1="' + f1(Y(dF.y)) + '" x2="' + f1(X(0)) + '" y2="' + f1(Y(0)) + '"/>');
        if (Math.abs(s0.a) * sc > 26) at((X(dF.x) + X(0)) / 2 + Math.cos(zr0) * 9, (Y(dF.y) + Y(0)) / 2 + Math.sin(zr0) * 9 + 4, Math.cos(zr0) >= 0 ? "start" : "end", f1(Math.abs(s0.a)) + "' " + (s0.a >= 0 ? "T" : "A"), "sp-lab");
        o.push('<line class="sp-az" x1="' + f1(X(dF.x)) + '" y1="' + f1(Y(dF.y)) + '" x2="' + f1(ax0) + '" y2="' + f1(ay0) + '"/>' + heads(ax0, ay0, Math.sin(zr0), -Math.cos(zr0), 1, "sp-trk"));
        at(ax0 + Math.sin(zr0) * 8, ay0 - Math.cos(zr0) * 8 + 4, Math.sin(zr0) >= 0 ? "start" : "end", "Zn " + p3(s0.zn) + "°", "sp-lab");
        o.push('<circle class="sp-fixdot" cx="' + f1(X(0)) + '" cy="' + f1(Y(0)) + '" r="3"/>');
        if (mk) o.push('<path class="sp-mark" d="M' + f1(X(mk.x)) + ' ' + f1(Y(mk.y) - 6) + ' l6 6 l-6 6 l-6 -6 z"/>');
      }
      else o.push('<circle class="sp-fixring" cx="' + f1(X(0)) + '" cy="' + f1(Y(0)) + '" r="8"/><circle class="sp-fixdot" cx="' + f1(X(0)) + '" cy="' + f1(Y(0)) + '" r="2.2"/>');
      fixed.concat(labels).forEach(function (b) { if (b.txt) o.push('<text class="' + b.cls + ' sp-halo" x="' + f1(b.x) + '" y="' + f1(b.y - 5) + '" text-anchor="' + b.end + '">' + esc(b.txt) + '</text>'); });
      o.push('</g>');
      /* compass rose: 10 degree ticks, the azimuth of each body as a numbered spoke */
      if (rose) {
        var rx = rose[0], ry = rose[1], g = ['<g class="sp-rose"><circle class="sp-rosebg" cx="' + f1(rx) + '" cy="' + f1(ry) + '" r="' + f1(rr) + '"/><circle class="sp-rosering" cx="' + f1(rx) + '" cy="' + f1(ry) + '" r="' + f1(rr) + '"/>'];
        for (k = 0; k < 360; k += 10) { var ka = k * R, kl = k % 90 === 0 ? 9 : k % 30 === 0 ? 6 : 3; g.push('<line class="sp-rosetk" x1="' + f1(rx + Math.sin(ka) * rr) + '" y1="' + f1(ry - Math.cos(ka) * rr) + '" x2="' + f1(rx + Math.sin(ka) * (rr - kl)) + '" y2="' + f1(ry - Math.cos(ka) * (rr - kl)) + '"/>'); }
        [[0, "000"], [90, "090"], [180, "180"], [270, "270"]].forEach(function (c4) { var ca = c4[0] * R, cr = rr + 7; g.push('<text class="sp-rosetx" x="' + f1(rx + Math.sin(ca) * cr + (c4[0] === 90 ? 9 : c4[0] === 270 ? -9 : 0)) + '" y="' + f1(ry - Math.cos(ca) * cr + (c4[0] === 0 ? 0 : c4[0] === 180 ? 7 : 3.5)) + '" text-anchor="middle">' + c4[1] + '</text>'); });
        L.forEach(function (l, i) { if (l.s.name === "Latitude") return; var za = l.s.zn * R, zx = Math.sin(za), zy = -Math.cos(za), col = "sp-c" + (i % 4);
          g.push('<line class="sp-spoke ' + col + '" x1="' + f1(rx) + '" y1="' + f1(ry) + '" x2="' + f1(rx + zx * (rr - 3)) + '" y2="' + f1(ry + zy * (rr - 3)) + '"/>' + heads(rx + zx * (rr - 3), ry + zy * (rr - 3), zx, zy, 1, col));
          g.push('<text class="sp-rosetx sp-lab sp-halo ' + col + '" x="' + f1(rx + zx * rr * 0.55 - zy * 8) + '" y="' + f1(ry + zy * rr * 0.55 + zx * 8 + 3.5) + '" text-anchor="middle">' + (i + 1) + '</text>'); });
        g.push('<circle class="sp-dr" cx="' + f1(rx) + '" cy="' + f1(ry) + '" r="2"/></g>'); o.push(g.join(""));
      }
      /* scale bar */
      var sb = nice(80 / sc), spx = sb * sc, bx = right - 14 - spx, by = bottom - 14;
      o.push('<g class="sp-scale"><line x1="' + f1(bx) + '" x2="' + f1(bx + spx) + '" y1="' + by + '" y2="' + by + '"/><line x1="' + f1(bx) + '" x2="' + f1(bx) + '" y1="' + (by - 4) + '" y2="' + (by + 4) + '"/><line x1="' + f1(bx + spx) + '" x2="' + f1(bx + spx) + '" y1="' + (by - 4) + '" y2="' + (by + 4) + '"/><text class="sp-lab" x="' + f1(bx + spx / 2) + '" y="' + (by - 7) + '" text-anchor="middle">' + sb + ' NM</text></g>');
      return o.join("");
    }
    return { build: build, geom: geom };
  })();
  /* SIGHTPLOT-END */
