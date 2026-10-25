  /* SIGHTPLOT-BEGIN */
  /* The plotting sheet: DR track, each line of position (dashed where the sight was taken, solid carried to the fix time),
     the fix, GPS, scale bar, north arrow, latitude and longitude ticks. Returns SVG markup. Needs SightFix. */
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
    /* opt.single: one position line. r.fix is then the ITP; opt.mark = { lat, lon, label } is the longitude by chronometer (or latitude) point */
    function build(r, inp, W, H, id, opt) {
      opt = opt || {};
      var fx = r.fix, drF = r.dr || SightFix.drAt(inp.dr, r.time), cosF = Math.cos(fx.lat * R);
      function pl(p) { var dl = p.lon - fx.lon; dl -= 360 * Math.round(dl / 360); return { x: dl * 60 * cosF, y: (p.lat - fx.lat) * 60 }; }
      var pts = [{ x: 0, y: 0 }], dF = pl(drF); pts.push(dF);
      var L = r.sights.map(function (s) {
        var ap = pl(s.ap), z = s.zn * R, lat = s.name === "Latitude";
        var af = lat ? s.a + dF.y : (s.ho - s.hcFix) * 60;             /* line as seen from the fix: intercept worked from the fix itself */
        var f1p = lat ? { x: 0, y: af } : { x: af * Math.sin(z), y: af * Math.cos(z) };
        var ds = s.drSight ? pl(s.drSight) : ap, f0 = { x: f1p.x + ds.x - dF.x, y: f1p.y + ds.y - dF.y };      /* the line where the sight was taken: carried back by the run from its time */
        pts.push(ap, f0, f1p);
        return { s: s, ap: ap, f0: f0, f1: f1p, dx: Math.cos(z), dy: -Math.sin(z) };
      });
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
      /* DR track and APs */
      var runNM = Math.hypot(dF.x - L[0].ap.x, dF.y - L[0].ap.y), first = L[0].ap;
      var tmin = L[0].s.ms; for (k = 1; k < L.length; k++) if (L[k].s.ms < tmin) { tmin = L[k].s.ms; first = L[k].ap; }
      if (runNM > 0.3) o.push('<line class="sp-track" x1="' + f1(X(first.x)) + '" y1="' + f1(Y(first.y)) + '" x2="' + f1(X(dF.x)) + '" y2="' + f1(Y(dF.y)) + '"/>');
      /* lines */
      var labels = [];
      L.forEach(function (l, i) {
        var big = (vx1 - vx0 + vy1 - vy0) * 2, dxp = l.dx * sc, dyp = -l.dy * sc;
        function seg(p, cls) { o.push('<line class="' + cls + '" x1="' + f1(X(p.x - l.dx * big)) + '" y1="' + f1(Y(p.y - l.dy * big)) + '" x2="' + f1(X(p.x + l.dx * big)) + '" y2="' + f1(Y(p.y + l.dy * big)) + '"/>'); }
        if (runNM > 0.3) { seg(l.f0, "sp-lop0"); o.push('<circle class="sp-ap" cx="' + f1(X(l.ap.x)) + '" cy="' + f1(Y(l.ap.y)) + '" r="3"/><circle class="sp-foot" cx="' + f1(X(l.f0.x)) + '" cy="' + f1(Y(l.f0.y)) + '" r="2"/>'); }
        else o.push('<circle class="sp-ap" cx="' + f1(X(l.ap.x)) + '" cy="' + f1(Y(l.ap.y)) + '" r="3"/>');
        seg(l.f1, "sp-lop");
        var c = clip(X(l.f1.x), Y(l.f1.y), dxp, dyp, left + 6, top + 6, right - 6, bottom - 6);
        if (c) {                                                                    /* try spots along the line until the label clashes with no other */
          var w = (l.s.name.length + 14) * 6.6, best = null, fr = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8];
          for (var q = 0; q < fr.length; q++) {
            var t = c[0] + fr[q] * (c[1] - c[0]), lx = X(l.f1.x) + dxp * t, ly = Y(l.f1.y) + dyp * t, end = lx < (left + right) / 2 ? "start" : "end";
            var bx = end === "start" ? lx : lx - w, cand = { x: lx, y: ly, end: end, l: l, b: [bx, ly - 16, bx + w, ly - 2] };
            if (!best) best = cand;
            if (!labels.some(function (o) { return !(cand.b[2] < o.b[0] || cand.b[0] > o.b[2] || cand.b[3] < o.b[1] || cand.b[1] > o.b[3]); })) { best = cand; break; }
          }
          labels.push(best);
        }
      });
      /* fix, GPS */
      if (gps) o.push('<path class="sp-gps" d="M' + f1(X(gps.x)) + ' ' + f1(Y(gps.y) - 6) + ' l6 6 l-6 6 l-6 -6 z"/><text class="sp-lab" x="' + f1(X(gps.x) + 9) + '" y="' + f1(Y(gps.y) + 4) + '">GPS</text>');
      o.push('<circle class="sp-dr" cx="' + f1(X(dF.x)) + '" cy="' + f1(Y(dF.y)) + '" r="3.5"/>');
      if (opt.single) {                                                               /* intercept from the DR to the ITP, and the direction of the body */
        var s0 = L[0].s, zr = s0.zn * R, al = 34 / sc;
        o.push('<line class="sp-int" x1="' + f1(X(dF.x)) + '" y1="' + f1(Y(dF.y)) + '" x2="' + f1(X(0)) + '" y2="' + f1(Y(0)) + '"/>');
        o.push('<line class="sp-az" x1="' + f1(X(dF.x)) + '" y1="' + f1(Y(dF.y)) + '" x2="' + f1(X(dF.x + al * Math.sin(zr))) + '" y2="' + f1(Y(dF.y + al * Math.cos(zr))) + '" marker-end="url(#' + id + 'a)"/>');
        o.push('<circle class="sp-fixdot" cx="' + f1(X(0)) + '" cy="' + f1(Y(0)) + '" r="3"/>');
        if (mk) o.push('<path class="sp-mark" d="M' + f1(X(mk.x)) + ' ' + f1(Y(mk.y) - 6) + ' l6 6 l-6 6 l-6 -6 z"/>');
      }
      else o.push('<circle class="sp-fixring" cx="' + f1(X(0)) + '" cy="' + f1(Y(0)) + '" r="8"/><circle class="sp-fixdot" cx="' + f1(X(0)) + '" cy="' + f1(Y(0)) + '" r="2.2"/>');
      labels.forEach(function (b) {
        var s = b.l.s, txt = s.name + " " + Math.round(s.zn) + "°  p " + f1(Math.abs(s.a)) + (s.name === "Latitude" ? "" : (s.a >= 0 ? " T" : " A"));
        o.push('<text class="sp-lab sp-halo" x="' + f1(b.x) + '" y="' + f1(b.y - 5) + '" text-anchor="' + b.end + '">' + esc(txt) + '</text>');
      });
      o.push('<text class="sp-lab sp-fixlab sp-halo" x="' + f1(X(0) + 11) + '" y="' + f1(Y(0) - 9) + '">' + (opt.single ? "ITP" : "FIX") + '</text>');
      if (mk) o.push('<text class="sp-lab sp-halo" x="' + f1(X(mk.x) + 10) + '" y="' + f1(Y(mk.y) + 16) + '">' + esc(opt.mark.label) + '</text>');
      o.push('<text class="sp-lab sp-drlab sp-halo" x="' + f1(X(dF.x) + 7) + '" y="' + f1(Y(dF.y) + 15) + '">DR</text>');
      o.push('</g>');
      /* scale bar and north arrow */
      var sb = nice(80 / sc), spx = sb * sc, bx = right - 14 - spx, by = bottom - 14;
      o.push('<g class="sp-scale"><line x1="' + f1(bx) + '" x2="' + f1(bx + spx) + '" y1="' + by + '" y2="' + by + '"/><line x1="' + f1(bx) + '" x2="' + f1(bx) + '" y1="' + (by - 4) + '" y2="' + (by + 4) + '"/><line x1="' + f1(bx + spx) + '" x2="' + f1(bx + spx) + '" y1="' + (by - 4) + '" y2="' + (by + 4) + '"/><text class="sp-lab" x="' + f1(bx + spx / 2) + '" y="' + (by - 7) + '" text-anchor="middle">' + sb + ' NM</text></g>');
      var nx = right - 22, ny = top + 40;
      o.push('<g class="sp-north"><line x1="' + nx + '" x2="' + nx + '" y1="' + ny + '" y2="' + (ny - 26) + '"/><path d="M' + nx + ' ' + (ny - 30) + ' l-4 9 l8 0 z"/><text class="sp-lab" x="' + nx + '" y="' + (ny - 36) + '" text-anchor="middle">N</text></g>');
      return o.join("");
    }
    return { build: build };
  })();
  /* SIGHTPLOT-END */
