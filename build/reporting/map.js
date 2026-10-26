  /* SEAMAP-BEGIN: a Mercator chart on a canvas (land from SA_LAND, grid, scale bar, drag / wheel / pinch zoom), the same engine as the Special Areas chart but reusable.
     The page draws its own layers in opts.layers(api) and gets taps in opts.onPick(lat, lon) and the pointer in opts.onHover(lat, lon, px, py). */
  function SeaMap(cv, wrap, opts) {
    var RAD = Math.PI / 180, ctx = cv.getContext("2d"), W = 800, H = 500, dpr = 1, raf = 0, view = opts.view || null, LAND = [], C = {};
    SA_LAND.forEach(function (rings) {
      var rs = rings.map(Geo.decode), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, ex = rs[0];
      for (var i = 0; i < ex.length; i += 2) { if (ex[i] < x0) x0 = ex[i]; if (ex[i] > x1) x1 = ex[i]; if (ex[i + 1] < y0) y0 = ex[i + 1]; if (ex[i + 1] > y1) y1 = ex[i + 1]; }
      LAND.push({ r: rs, b: [x0, y0, x1, y1] });
    });
    function css(token) { var e = document.createElement("span"); e.style.cssText = "position:absolute;visibility:hidden;color:var(" + token + ")"; document.body.appendChild(e); var v = getComputedStyle(e).color; document.body.removeChild(e); return v; }
    function colors() { ["sea", "land", "coast", "grid", "ink"].forEach(function (k) { C[k] = css("--map-" + k); }); (opts.tokens || []).forEach(function (t) { C[t] = css("--" + t); }); C.paper = css("--paper"); C.font = getComputedStyle(document.body).fontFamily; }
    function alpha(rgb, a) { var m = String(rgb).match(/[\d.]+/g) || [0, 0, 0]; return "rgba(" + m[0] + "," + m[1] + "," + m[2] + "," + a + ")"; }
    function minScale() { return Math.max(W / 360, H / 170); }
    function X(lon) { return (lon - view.cx) * view.s + W / 2; }
    function Y(lat) { return H / 2 - (Geo.mercY(lat) - view.cy) * view.s; }
    function lonAt(px) { return (px - W / 2) / view.s + view.cx; }
    function latAt(py) { return Geo.invMercY(view.cy + (H / 2 - py) / view.s); }
    function clamp() {
      view.s = Math.max(minScale(), Math.min(40000, view.s));
      var halfH = H / 2 / view.s, lim = Geo.mercY(82);
      view.cy = Math.max(-lim + halfH * 0.2, Math.min(lim - halfH * 0.2, view.cy));
      if (view.cx > 180) view.cx -= 360; if (view.cx < -180) view.cx += 360;
    }
    function changed() { if (opts.onView) opts.onView({ cx: view.cx, cy: view.cy, s: view.s }); }
    function world() { view = { cx: 30, cy: Geo.mercY(25), s: minScale() }; clamp(); changed(); draw(); }
    function fitBox(b, pad) {                                      /* b = [lon0, lat0, lon1, lat1]; lon1 may be above 180 for a box across the date line */
      if (!W) return;
      var dx = Math.max(b[2] - b[0], 0.05), dy = Math.max(Geo.mercY(b[3]) - Geo.mercY(b[1]), 0.05), k = pad || 1.15;
      view = { cx: (b[0] + b[2]) / 2, cy: (Geo.mercY(b[1]) + Geo.mercY(b[3])) / 2, s: Math.min(W / (dx * k), H / (dy * k)) };
      clamp(); changed(); draw();
    }
    function zoomAt(f, px, py) {
      var lo = lonAt(px), my = view.cy + (H / 2 - py) / view.s;
      view.s *= f; clamp(); view.cx = lo - (px - W / 2) / view.s; view.cy = my - (H / 2 - py) / view.s; clamp(); changed(); draw();
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }
    function resize() {
      var r = wrap.getBoundingClientRect(); if (!r.width) return;
      dpr = window.devicePixelRatio || 1; W = Math.round(r.width); H = Math.round(r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (!view || !isFinite(view.s)) world(); else clamp();
      draw();
    }
    function offsets() { var o = [], lo0 = lonAt(0), lo1 = lonAt(W); [-360, 0, 360].forEach(function (k) { if (lo1 + k > -190 && lo0 + k < 190) o.push(k); }); return o; }
    function seen(b, off) { var lo0 = lonAt(0), lo1 = lonAt(W), la0 = latAt(H), la1 = latAt(0); return b[2] + off >= lo0 && b[0] + off <= lo1 && b[3] >= la0 && b[1] <= la1; }
    function niceStep(minDeg) { var S = [1 / 60, 2 / 60, 5 / 60, 10 / 60, 15 / 60, 30 / 60, 1, 2, 5, 10, 20, 30, 60]; for (var i = 0; i < S.length; i++) if (S[i] >= minDeg) return S[i]; return 60; }
    function label(v, isLat) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + "°" + (m ? ("0" + m).slice(-2) + "'" : "") + (isLat ? (v < 0 ? "S" : "N") : (v < 0 ? "W" : "E")); }
    function ring(r, off) { for (var i = 0; i < r.length; i += 2) { var x = X(r[i] + off), y = Y(r[i + 1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); }
    function grid() {
      var lat0 = latAt(H), lat1 = latAt(0), lon0 = lonAt(0), lon1 = lonAt(W), step = Math.max(niceStep(90 / view.s), niceStep(70 / view.s / Math.max(0.05, 1 / Math.cos(latAt(H / 2) * RAD))));
      ctx.lineWidth = 1; ctx.strokeStyle = C.grid; ctx.fillStyle = C.ink; ctx.font = "11px " + C.font; ctx.beginPath();
      for (var lo = Math.ceil(lon0 / step) * step; lo <= lon1; lo += step) { var x = Math.round(X(lo)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (var la = Math.ceil(Math.max(lat0, -85) / step) * step; la <= Math.min(lat1, 85); la += step) { var y = Math.round(Y(la)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke(); ctx.textBaseline = "top"; ctx.textAlign = "left";
      for (lo = Math.ceil(lon0 / step) * step; lo <= lon1; lo += step) ctx.fillText(label(((lo + 180) % 360 + 360) % 360 - 180, false), X(lo) + 3, 3);
      ctx.textBaseline = "bottom";
      for (la = Math.ceil(Math.max(lat0, -85) / step) * step; la <= Math.min(lat1, 85); la += step) ctx.fillText(label(la, true), 3, Y(la) - 2);
    }
    function land(offs) {
      ctx.fillStyle = C.land; ctx.strokeStyle = C.coast; ctx.lineWidth = 0.8; ctx.lineJoin = "round";
      offs.forEach(function (off) {
        LAND.forEach(function (p) {
          if (!seen(p.b, off)) return;
          if ((p.b[2] - p.b[0]) * view.s < 1.2 && (Geo.mercY(p.b[3]) - Geo.mercY(p.b[1])) * view.s < 1.2) return;
          ctx.beginPath(); p.r.forEach(function (r) { ring(r, off); }); ctx.fill("evenodd"); ctx.stroke();
        });
      });
    }
    function scaleBar() {
      var nmPerPx = 60 * Math.cos(latAt(H / 2) * RAD) / view.s, T = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], nm = 1;
      for (var k = 0; k < T.length; k++) { nm = T[k]; if (nm / nmPerPx >= 90) break; }
      var len = nm / nmPerPx, bx = 14, by = H - 16;
      ctx.fillStyle = alpha(C.sea, 0.8); ctx.fillRect(bx - 6, by - 20, len + 12, 34);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by); ctx.lineTo(bx + len, by); ctx.lineTo(bx + len, by - 6); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = "11px " + C.font; ctx.fillText(nm + " NM", bx, by - 5);
    }
    var api = { ctx: function () { return ctx; }, X: X, Y: Y, lonAt: lonAt, latAt: latAt, W: function () { return W; }, H: function () { return H; }, scale: function () { return view.s; },
      offsets: offsets, seen: seen, ring: ring, alpha: alpha, C: C, land: null };
    function draw() {
      if (!view) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.sea; ctx.fillRect(0, 0, W, H);
      var offs = offsets(); grid();
      if (opts.under) opts.under(api, offs);                       /* fills under the land, so the coast always shows clean */
      land(offs);
      if (opts.layers) opts.layers(api, offs);
      scaleBar();
    }
    /* pointer: drag to move, wheel or pinch to zoom, tap to pick */
    var ptrs = {}, drag = null, pinch = null, moved = 0;
    function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener("pointerdown", function (e) {
      cv.setPointerCapture(e.pointerId); var l = local(e); ptrs[e.pointerId] = l; moved = 0; var ids = Object.keys(ptrs);
      if (ids.length === 1) drag = { x: l.x, y: l.y, cx: view.cx, cy: view.cy };
      else if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; }
    });
    cv.addEventListener("pointermove", function (e) {
      var l = local(e);
      if (ptrs[e.pointerId]) {
        ptrs[e.pointerId] = l; var ids = Object.keys(ptrs);
        if (ids.length === 2 && pinch) { var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; moved = 99; return; }
        if (drag) { var dx = l.x - drag.x, dy = l.y - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); if (moved > 4) { cv.classList.add("drag"); view.cx = drag.cx - dx / view.s; view.cy = drag.cy + dy / view.s; clamp(); schedule(); } }
      } else if (opts.onHover) { opts.onHover(latAt(l.y), ((lonAt(l.x) + 180) % 360 + 360) % 360 - 180, l.x, l.y); }
    });
    function up(e) {
      var l = local(e), was = ptrs[e.pointerId]; delete ptrs[e.pointerId]; cv.classList.remove("drag");
      if (Object.keys(ptrs).length < 2) pinch = null;
      if (was && moved <= 4 && !pinch && opts.onPick) opts.onPick(latAt(l.y), ((lonAt(l.x) + 180) % 360 + 360) % 360 - 180, l.x, l.y);
      else if (moved > 4) changed();
      drag = null;
    }
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", function (e) { delete ptrs[e.pointerId]; drag = null; pinch = null; cv.classList.remove("drag"); });
    cv.addEventListener("wheel", function (e) { e.preventDefault(); var l = local(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, l.x, l.y); }, { passive: false });
    cv.addEventListener("dblclick", function (e) { var l = local(e); zoomAt(2, l.x, l.y); });
    cv.addEventListener("keydown", function (e) {
      var k = e.key, step = 60 / view.s;
      if (k === "+" || k === "=") zoomAt(1.4, W / 2, H / 2); else if (k === "-") zoomAt(1 / 1.4, W / 2, H / 2);
      else if (k === "ArrowLeft") view.cx -= step; else if (k === "ArrowRight") view.cx += step; else if (k === "ArrowUp") view.cy += step; else if (k === "ArrowDown") view.cy -= step; else return;
      e.preventDefault(); clamp(); changed(); draw();
    });
    window.addEventListener("resize", resize);
    new MutationObserver(function () { colors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    colors();
    return { draw: draw, redraw: schedule, resize: resize, world: world, fitBox: fitBox, zoomIn: function () { zoomAt(1.6, W / 2, H / 2); }, zoomOut: function () { zoomAt(1 / 1.6, W / 2, H / 2); },
      api: api, toDataURL: function () { return cv.toDataURL("image/png"); } };
  }
  /* SEAMAP-END */
