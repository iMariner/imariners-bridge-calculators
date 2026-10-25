  /* Tool: Special Areas & Map */
  function initAreas() {
    var KEY = "bridgeCalc.areas", RAD = Math.PI / 180;
    var AREAS = SA_AREAS, byId = {}, LAND = [];
    AREAS.forEach(function (a) { byId[a.id] = a; });
    AREAS.forEach(function (a) {
      var src = a.regionSame ? byId[a.regionSame] : a;
      if (!src.rg) src.rg = (src.region || []).map(Geo.decode);
      a.rg = src.rg;
      a.pmap = {}; a.pts.forEach(function (p) { a.pmap[p.n] = p; });
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      function add(lo, la) { if (lo < x0) x0 = lo; if (lo > x1) x1 = lo; if (la < y0) y0 = la; if (la > y1) y1 = la; }
      a.rg.forEach(function (r) { for (var i = 0; i < r.length; i += 2) add(r[i], r[i + 1]); });
      a.pts.forEach(function (p) { add(p.lo, p.la); });
      if (a.shape === "lat_limit") { x0 = -180; x1 = 180; y0 = -85; y1 = a.lat_limit || -60; }
      a.box = x1 < x0 ? null : [x0, y0, x1, y1];
      a.kind = /ECA/.test(a.cat) ? "eca" : "special";
    });
    SA_LAND.forEach(function (rings) {
      var rs = rings.map(Geo.decode), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, ex = rs[0];
      for (var i = 0; i < ex.length; i += 2) { if (ex[i] < x0) x0 = ex[i]; if (ex[i] > x1) x1 = ex[i]; if (ex[i + 1] < y0) y0 = ex[i + 1]; if (ex[i + 1] > y1) y1 = ex[i + 1]; }
      LAND.push({ r: rs, b: [x0, y0, x1, y1] });
    });
    var st = store.get(KEY) || {};
    var vis = {}; (st.vis || ["marpol-nw-european-waters", "marpol-north-sea-annex-v", "eca-mediterranean"]).forEach(function (id) { if (byId[id]) vis[id] = true; });
    var selId = byId[st.sel] ? st.sel : "marpol-nw-european-waters";
    var pos = Array.isArray(st.pos) ? st.pos.filter(function (p) { return p && isFinite(p.lat) && isFinite(p.lon); }).slice(0, 60) : [];
    var join = !!st.join, showSheet = !!st.sheet, pick = null, hoverPt = null;
    var view = st.view && isFinite(st.view.cx) && isFinite(st.view.cy) && st.view.s > 0 ? { cx: st.view.cx, cy: st.view.cy, s: st.view.s } : null;
    function save() { store.set(KEY, { vis: Object.keys(vis), sel: selId, pos: pos, join: join, sheet: showSheet, view: view }); }

    /* ---------- colours follow the theme ---------- */
    var C = {};
    function css(token) { var e = document.createElement("span"); e.style.cssText = "position:absolute;visibility:hidden;color:var(" + token + ")"; document.body.appendChild(e); var v = getComputedStyle(e).color; document.body.removeChild(e); return v; }
    function withAlpha(rgb, a) { var m = rgb.match(/[\d.]+/g); return "rgba(" + m[0] + "," + m[1] + "," + m[2] + "," + a + ")"; }
    function loadColors() { ["sea", "land", "coast", "grid", "ink"].forEach(function (k) { C[k] = css("--map-" + k); }); C.special = css("--area-special"); C.eca = css("--area-eca"); C.pos = css("--pos-mark"); C.paper = css("--paper"); }

    /* ---------- map engine ---------- */
    var cv = $("sa-canvas"), wrap = $("sa-wrap"), ctx = cv.getContext("2d"), W = 800, H = 500, dpr = 1, raf = 0;
    function minScale() { return Math.max(W / 360, H / 170); }
    function X(lon) { return (lon - view.cx) * view.s + W / 2; }
    function Y(lat) { return H / 2 - (Geo.mercY(lat) - view.cy) * view.s; }
    function lonAt(px) { return (px - W / 2) / view.s + view.cx; }
    function latAt(py) { return Geo.invMercY(view.cy + (H / 2 - py) / view.s); }
    function clampView() {
      view.s = Math.max(minScale(), Math.min(40000, view.s));
      var maxY = 82, halfH = H / 2 / view.s, lim = Geo.mercY(maxY);
      view.cy = Math.max(-lim + halfH * 0.2, Math.min(lim - halfH * 0.2, view.cy));
      if (view.cx > 180) view.cx -= 360; if (view.cx < -180) view.cx += 360;
    }
    function resize() {
      var r = wrap.getBoundingClientRect(); if (!r.width) return;
      dpr = window.devicePixelRatio || 1; W = Math.round(r.width); H = Math.round(r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (!view) world(); else clampView();
      draw();
    }
    function world() { view = { cx: 0, cy: Geo.mercY(25), s: minScale() }; clampView(); }
    function fitBox(b, pad) {
      var dx = Math.max(b[2] - b[0], 0.05), dy = Math.max(Geo.mercY(b[3]) - Geo.mercY(b[1]), 0.05), k = pad || 1.15;
      view = { cx: (b[0] + b[2]) / 2, cy: (Geo.mercY(b[1]) + Geo.mercY(b[3])) / 2, s: Math.min(W / (dx * k), H / (dy * k)) };
      clampView(); save(); draw();
    }
    function zoomAt(f, px, py) {
      var lo = lonAt(px), my = view.cy + (H / 2 - py) / view.s;
      view.s *= f; clampView();
      view.cx = lo - (px - W / 2) / view.s; view.cy = my - (H / 2 - py) / view.s; clampView(); save(); draw();
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

    function pathRing(r, off) {
      for (var i = 0; i < r.length; i += 2) { var x = X(r[i] + off), y = Y(r[i + 1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.closePath();
    }
    function niceStep(minDeg) {
      var S = [1 / 60, 2 / 60, 5 / 60, 10 / 60, 15 / 60, 30 / 60, 1, 2, 5, 10, 20, 30, 60];
      for (var i = 0; i < S.length; i++) if (S[i] >= minDeg) return S[i]; return 60;
    }
    function label(v, isLat) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + "°" + (m ? ("0" + m).slice(-2) + "'" : "") + (isLat ? (v < 0 ? "S" : "N") : (v < 0 ? "W" : "E")); }
    function drawGrid() {
      var lat0 = latAt(H), lat1 = latAt(0), lon0 = lonAt(0), lon1 = lonAt(W);
      var stepLon = niceStep(90 / view.s), stepLat = niceStep(70 / view.s / Math.max(0.05, 1 / Math.cos(latAt(H / 2) * RAD)));
      var step = Math.max(stepLon, stepLat);
      ctx.lineWidth = 1; ctx.strokeStyle = C.grid; ctx.fillStyle = C.ink; ctx.font = "11px " + getComputedStyle(document.body).fontFamily; ctx.globalAlpha = 1;
      ctx.beginPath();
      for (var lo = Math.ceil(lon0 / step) * step; lo <= lon1; lo += step) { var x = Math.round(X(lo)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (var la = Math.ceil(Math.max(lat0, -85) / step) * step; la <= Math.min(lat1, 85); la += step) { var y = Math.round(Y(la)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      for (lo = Math.ceil(lon0 / step) * step; lo <= lon1; lo += step) { var lw = ((lo + 180) % 360 + 360) % 360 - 180; ctx.fillText(label(lw, false), X(lo) + 3, 3); }
      ctx.textBaseline = "bottom";
      for (la = Math.ceil(Math.max(lat0, -85) / step) * step; la <= Math.min(lat1, 85); la += step) ctx.fillText(label(la, true), 3, Y(la) - 2);
    }
    function offsets() { var o = [], lo0 = lonAt(0), lo1 = lonAt(W); [-360, 0, 360].forEach(function (k) { if (lo1 + k > -190 && lo0 + k < 190) o.push(k); }); return o; }
    function vis2(b, off, lo0, lo1, la0, la1) { return b[2] + off >= lo0 && b[0] + off <= lo1 && b[3] >= la0 && b[1] <= la1; }
    function ptLabelText(p) { return p.n; }

    function draw() {
      if (!view) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.sea; ctx.fillRect(0, 0, W, H);
      var lo0 = lonAt(0), lo1 = lonAt(W), la0 = latAt(H), la1 = latAt(0), offs = offsets();
      drawGrid();
      /* area fills under the land, so the coast always shows clean */
      AREAS.forEach(function (a) {
        if (!vis[a.id] || !a.box) return;
        ctx.fillStyle = withAlpha(a.kind === "eca" ? C.eca : C.special, a.id === selId ? 0.42 : 0.28);
        offs.forEach(function (off) {
          if (!vis2(a.box, off, lo0, lo1, la0, la1)) return;
          if (a.shape === "lat_limit") { ctx.beginPath(); var yy = Y(a.lat_limit || -60); ctx.rect(0, yy, W, H - yy); ctx.fill(); return; }
          ctx.beginPath(); a.rg.forEach(function (r) { pathRing(r, off); }); ctx.fill();
        });
      });
      ctx.fillStyle = C.land; ctx.strokeStyle = C.coast; ctx.lineWidth = 0.8; ctx.lineJoin = "round";
      offs.forEach(function (off) {
        LAND.forEach(function (p) {
          if (!vis2(p.b, off, lo0, lo1, la0, la1)) return;
          if ((p.b[2] - p.b[0]) * view.s < 1.2 && (Geo.mercY(p.b[3]) - Geo.mercY(p.b[1])) * view.s < 1.2) return;
          ctx.beginPath(); p.r.forEach(function (r) { pathRing(r, off); }); ctx.fill("evenodd"); ctx.stroke();
        });
      });
      /* boundary lines */
      AREAS.forEach(function (a) {
        if (!vis[a.id]) return;
        var col = a.kind === "eca" ? C.eca : C.special; ctx.strokeStyle = col; ctx.lineWidth = a.id === selId ? 3 : 2; ctx.setLineDash(a.kind === "eca" ? [7, 4] : []);
        offs.forEach(function (off) {
          if (a.shape === "lat_limit") { ctx.beginPath(); var yy = Y(a.lat_limit || -60); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); return; }
          if (!a.box || !vis2(a.box, off, lo0, lo1, la0, la1)) return;
          ctx.beginPath();
          if (a.shape === "polygon") { a.pts.forEach(function (p, i) { var x = X(p.lo + off), y = Y(p.la); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
          else (a.lines || []).forEach(function (seq) { seq.forEach(function (n, i) { var p = a.pmap[n]; if (!p) return; var x = X(p.lo + off), y = Y(p.la); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); });
          ctx.stroke();
        });
        ctx.setLineDash([]);
      });
      /* points of the selected area, and of any area when zoomed in */
      ctx.font = "bold 11px " + getComputedStyle(document.body).fontFamily; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      AREAS.forEach(function (a) {
        if (!vis[a.id]) return;
        var show = a.id === selId || view.s > 120; if (!show) return;
        offs.forEach(function (off) {
          a.pts.forEach(function (p) {
            var x = X(p.lo + off), y = Y(p.la); if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return;
            ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = p.inf ? C.sea : C.ink; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = p.inf ? C.pos : C.ink; ctx.stroke();
            if (a.id === selId && (view.s > 40 || a.pts.length < 40)) { ctx.fillStyle = C.ink; ctx.fillText(ptLabelText(p), x + 7, y - 7); }
          });
        });
      });
      if (hoverPt) { var hx = X(hoverPt.p.lo), hy = Y(hoverPt.p.la); ctx.beginPath(); ctx.arc(hx, hy, 8, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); }
      /* my positions */
      if (join && pos.length > 1) { ctx.beginPath(); ctx.strokeStyle = C.pos; ctx.lineWidth = 2; offs.forEach(function (off) { pos.forEach(function (p, i) { var x = X(p.lon + off), y = Y(p.lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); }); ctx.stroke(); }
      ctx.textAlign = "center";
      offs.forEach(function (off) {
        pos.forEach(function (p, i) {
          var x = X(p.lon + off), y = Y(p.lat); if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
          ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fillStyle = C.pos; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.paper; ctx.stroke();
          ctx.fillStyle = C.paper; ctx.font = "bold 11px " + getComputedStyle(document.body).fontFamily; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), x, y + 0.5);
          if (p.name) { ctx.textAlign = "left"; ctx.fillStyle = C.ink; ctx.fillText(p.name, x + 14, y); ctx.textAlign = "center"; }
        });
      });
      if (showSheet) {
        ctx.font = "bold 10px " + getComputedStyle(document.body).fontFamily; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        offs.forEach(function (off) { SA_SHEET.forEach(function (s) { var x = X(s.lo + off), y = Y(s.la); if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return; ctx.lineWidth = 2; ctx.strokeStyle = C.pos; ctx.strokeRect(x - 5, y - 5, 10, 10); ctx.fillStyle = C.ink; ctx.fillText("row " + s.row, x + 8, y); }); });
      }
      if (pick) {
        var px = X(pick.lon), py = Y(pick.lat);
        ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.stroke();
      }
      /* scale bar */
      var nmPerPx = 60 * Math.cos(latAt(H / 2) * RAD) / view.s, targets = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], nm = 1, k;
      for (k = 0; k < targets.length; k++) { nm = targets[k]; if (nm / nmPerPx >= 90) break; }
      var len = nm / nmPerPx, bx = 14, by = H - 16;
      ctx.fillStyle = withAlpha(C.sea, 0.8); ctx.fillRect(bx - 6, by - 20, len + 12, 34);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by); ctx.lineTo(bx + len, by); ctx.lineTo(bx + len, by - 6); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = "11px " + getComputedStyle(document.body).fontFamily; ctx.fillText(nm + " NM", bx, by - 5);
    }

    /* ---------- pointer interaction ---------- */
    var ptrs = {}, drag = null, pinch = null, moved = 0;
    function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function findPoint(px, py) {
      var best = null, bd = 9;
      AREAS.forEach(function (a) {
        if (!vis[a.id] || !(a.id === selId || view.s > 120)) return;
        a.pts.forEach(function (p) { var d = Math.hypot(X(p.lo) - px, Y(p.la) - py); if (d < bd) { bd = d; best = { p: p, a: a }; } });
      });
      return best;
    }
    function cursorText(px, py) {
      var la = latAt(py), lo = lonAt(px); lo = ((lo + 180) % 360 + 360) % 360 - 180;
      var h = findPoint(px, py); hoverPt = h;
      $("sa-cursor").textContent = Geo.lat(la) + "  " + Geo.lon(lo) + (h ? "   •  " + h.a.title + " point " + h.p.n + (h.p.nm ? ": " + h.p.nm : "") + (h.p.inf ? " (from the coastline, not official)" : " (official)") : "");
    }
    cv.addEventListener("pointerdown", function (e) {
      cv.setPointerCapture(e.pointerId); var l = local(e); ptrs[e.pointerId] = l; moved = 0;
      var ids = Object.keys(ptrs);
      if (ids.length === 1) drag = { x: l.x, y: l.y, cx: view.cx, cy: view.cy };
      else if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; drag = null; }
    });
    cv.addEventListener("pointermove", function (e) {
      var l = local(e);
      if (ptrs[e.pointerId]) {
        ptrs[e.pointerId] = l; var ids = Object.keys(ptrs);
        if (ids.length === 2 && pinch) { var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; var f = d / pinch.d * pinch.s / view.s; zoomAt(f, mx, my); pinch.s = view.s; pinch.d = d; moved = 99; return; }
        if (drag) {
          var dx = l.x - drag.x, dy = l.y - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
          if (moved > 4) { cv.classList.add("drag"); view.cx = drag.cx - dx / view.s; view.cy = drag.cy + dy / view.s; clampView(); schedule(); }
        }
      } else { cursorText(l.x, l.y); schedule(); }
    });
    function up(e) {
      var l = local(e), was = ptrs[e.pointerId]; delete ptrs[e.pointerId]; cv.classList.remove("drag");
      if (Object.keys(ptrs).length < 2) pinch = null;
      if (was && moved <= 4 && !pinch) setPick(latAt(l.y), ((lonAt(l.x) + 180) % 360 + 360) % 360 - 180);
      else if (moved > 4) save();
      drag = null;
    }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", function (e) { delete ptrs[e.pointerId]; drag = null; pinch = null; cv.classList.remove("drag"); });
    cv.addEventListener("pointerleave", function () { hoverPt = null; schedule(); });
    cv.addEventListener("wheel", function (e) { e.preventDefault(); var l = local(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, l.x, l.y); }, { passive: false });
    cv.addEventListener("dblclick", function (e) { var l = local(e); zoomAt(2, l.x, l.y); });
    cv.addEventListener("keydown", function (e) {
      var k = e.key, step = 60 / view.s;
      if (k === "+" || k === "=") zoomAt(1.4, W / 2, H / 2); else if (k === "-") zoomAt(1 / 1.4, W / 2, H / 2);
      else if (k === "ArrowLeft") { view.cx -= step; } else if (k === "ArrowRight") { view.cx += step; } else if (k === "ArrowUp") { view.cy += step; } else if (k === "ArrowDown") { view.cy -= step; } else return;
      e.preventDefault(); clampView(); save(); draw();
    });
    $("sa-zin").addEventListener("click", function () { zoomAt(1.6, W / 2, H / 2); });
    $("sa-zout").addEventListener("click", function () { zoomAt(1 / 1.6, W / 2, H / 2); });
    $("sa-world").addEventListener("click", function () { world(); save(); draw(); });
    $("sa-fit").addEventListener("click", function () { var a = byId[selId]; if (a && a.box) fitBox(a.box); });
    $("sa-fitpos").addEventListener("click", function () {
      if (!pos.length) { toast("Add a position first"); return; }
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pos.forEach(function (p) { x0 = Math.min(x0, p.lon); x1 = Math.max(x1, p.lon); y0 = Math.min(y0, p.lat); y1 = Math.max(y1, p.lat); });
      var padx = Math.max(1.5, (x1 - x0) * 0.2), pady = Math.max(1.5, (y1 - y0) * 0.2); fitBox([x0 - padx, Math.max(-84, y0 - pady), x1 + padx, Math.min(84, y1 + pady)], 1.0);
    });

    /* ---------- where is a point ---------- */
    function inside(a, lat, lon) {
      if (a.shape === "lat_limit") return lat <= (a.lat_limit || -60);
      if (!a.box || lat < a.box[1] - 0.2 || lat > a.box[3] + 0.2 || lon < a.box[0] - 0.2 || lon > a.box[2] + 0.2) return false;
      for (var i = 0; i < a.rg.length; i++) if (Geo.pointInRing(lon, lat, a.rg[i])) return true;
      return false;
    }
    function nearest(a, lat, lon) {                      /* NM to the nearest boundary line of area a, or null */
      if (a.shape === "lat_limit") return Math.abs(lat - (a.lat_limit || -60)) * 60;
      var best = null;
      function seg(p, q) { if (!p || !q) return; var d = Geo.distSegNM(lat, lon, p.la, p.lo, q.la, q.lo); if (best === null || d < best) best = d; }
      if (a.shape === "polygon") { for (var i = 0; i < a.pts.length; i++) seg(a.pts[i], a.pts[(i + 1) % a.pts.length]); }
      else (a.lines || []).forEach(function (s) { for (var i = 0; i + 1 < s.length; i++) seg(a.pmap[s[i]], a.pmap[s[i + 1]]); });
      return best;
    }
    function check(lat, lon) {
      var ins = [], near = [];
      AREAS.forEach(function (a) {
        if (!a.box && a.shape !== "lat_limit") return;
        if (inside(a, lat, lon)) ins.push(a); else { var d = nearest(a, lat, lon); if (d !== null) near.push({ a: a, d: d }); }
      });
      near.sort(function (x, y) { return x.d - y.d; });
      return { ins: ins, near: near.slice(0, 2) };
    }
    function nmText(d) { return d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString("en-US"); }
    function statusTag(a) { return a.status && a.status !== "in effect" ? " (" + a.status + ")" : ""; }
    function resultHtml(r, el) {
      el.textContent = "";
      function span(cls, t) { var s = document.createElement("span"); if (cls) s.className = cls; s.textContent = t; el.appendChild(s); return s; }
      if (r.ins.length) { span("in", "INSIDE: "); span("", r.ins.map(function (a) { return a.title + statusTag(a); }).join("; ")); }
      else span("", "Outside all listed areas.");
      if (r.near.length) { el.appendChild(document.createElement("br")); span("", "Nearest boundary: " + r.near.map(function (n) { return n.a.title + " about " + nmText(n.d) + " NM"; }).join("; ")); }
    }
    function setPick(lat, lon) {
      pick = { lat: lat, lon: lon }; $("sa-pick").hidden = false;
      $("sa-pick-pos").textContent = Geo.lat(lat) + "  " + Geo.lon(lon);
      resultHtml(check(lat, lon), $("sa-pick-info")); draw();
    }
    $("sa-pick-copy").addEventListener("click", function () { if (pick) copyText(Geo.lat(pick.lat) + " " + Geo.lon(pick.lon)); });
    $("sa-pick-add").addEventListener("click", function () { if (pick) { addPos("", pick.lat, pick.lon); } });

    /* ---------- area list and details ---------- */
    function renderList() {
      var q = $("sa-search").value.trim().toLowerCase(), box = $("sa-list"); box.textContent = "";
      [["special", "MARPOL special areas"], ["eca", "Emission control areas (ECAs)"]].forEach(function (g) {
        var items = AREAS.filter(function (a) { return a.kind === g[0] && (!q || (a.title + " " + a.cat).toLowerCase().indexOf(q) >= 0); });
        if (!items.length) return;
        var h = document.createElement("div"); h.className = "sa-grp"; h.textContent = g[1]; box.appendChild(h);
        items.forEach(function (a) {
          var row = document.createElement("div"); row.className = "sa-item" + (a.id === selId ? " sel" : ""); row.setAttribute("data-id", a.id);
          var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!vis[a.id]; cb.setAttribute("aria-label", "Show " + a.title + " on the chart");
          var tx = document.createElement("div"), b = document.createElement("b"), sp = document.createElement("span"), sw = document.createElement("i");
          sw.className = "sa-sw c-" + a.kind; b.appendChild(sw); b.appendChild(document.createTextNode(a.title));
          sp.textContent = (a.annexes && a.annexes.length ? "Annex " + a.annexes.join(", ") + " · " : "") + (a.status || "");
          tx.appendChild(b); tx.appendChild(sp); row.appendChild(cb); row.appendChild(tx); box.appendChild(row);
        });
      });
    }
    $("sa-list").addEventListener("click", function (e) {
      var row = e.target.closest(".sa-item"); if (!row) return; var id = row.getAttribute("data-id");
      if (e.target.tagName === "INPUT") { if (e.target.checked) vis[id] = true; else delete vis[id]; save(); draw(); return; }
      vis[id] = true; selId = id; save(); renderList(); renderDetail(); var a = byId[id]; if (a.box) fitBox(a.box);
    });
    $("sa-search").addEventListener("input", renderList);
    $("sa-showall").addEventListener("click", function () { AREAS.forEach(function (a) { vis[a.id] = true; }); save(); renderList(); draw(); });
    $("sa-hideall").addEventListener("click", function () { vis = {}; save(); renderList(); draw(); });

    function cellTxt(tag, txt, cls) { var c = document.createElement(tag); c.textContent = txt; if (cls) c.className = cls; return c; }
    function renderDetail() {
      var a = byId[selId], card = $("sa-detail"); if (!a) { card.hidden = true; return; } card.hidden = false;
      $("sa-d-cat").textContent = a.cat; $("sa-d-title").textContent = a.title;
      var meta = $("sa-d-meta"); meta.textContent = "";
      function m(k, v) { if (!v) return; var s = document.createElement("span"); s.textContent = k + " "; var b = document.createElement("b"); b.textContent = v; s.appendChild(b); meta.appendChild(s); }
      m("Status:", a.status); m("In effect from:", a.eff); if (a.pollutants) m("Controls:", a.pollutants.join(", ")); m("Checked source quality:", a.conf);
      if (a.effNote) { var en = document.createElement("div"); en.className = "muted"; en.style.flexBasis = "100%"; en.textContent = a.effNote; meta.appendChild(en); }
      $("sa-d-quote-wrap").hidden = !a.quote; $("sa-d-quote").textContent = a.quote || "";
      var tbl = $("sa-d-pts"); tbl.textContent = "";
      if (!a.pts.length) { tbl.appendChild(cellTxt("caption", a.shape === "lat_limit" ? "Boundary: " + Geo.lat(a.lat_limit) + ": every sea area south of this latitude." : "No coordinates published yet.")); }
      else {
        var th = document.createElement("thead"), hr = document.createElement("tr");
        [["No.", ""], ["Point", ""], ["Latitude", "num"], ["Longitude", "num"], ["Source", ""]].forEach(function (h) { hr.appendChild(cellTxt("th", h[0], h[1])); }); th.appendChild(hr); tbl.appendChild(th);
        var tb = document.createElement("tbody");
        a.pts.forEach(function (p) {
          var tr = document.createElement("tr"); tr.appendChild(cellTxt("td", p.n)); tr.appendChild(cellTxt("td", p.nm, "wrap")); tr.appendChild(cellTxt("td", Geo.lat(p.la), "num")); tr.appendChild(cellTxt("td", Geo.lon(p.lo), "num"));
          var td = document.createElement("td"), tag = document.createElement("span"); tag.className = "sa-tag " + (p.inf ? "inf" : "ok"); tag.textContent = p.inf ? "COAST POINT" : "OFFICIAL"; td.appendChild(tag); tr.appendChild(td); tb.appendChild(tr);
          tr.addEventListener("click", function () { setPick(p.la, p.lo); });
        });
        tbl.appendChild(tb);
      }
      var nt = a.notes || ""; if (a.pts.some(function (p) { return p.inf; })) nt = "COAST POINT: the regulation gives only a latitude or longitude and says the line meets the coast; the other value is read from the coastline and is for drawing, not official. " + nt;
      $("sa-d-notes").textContent = nt;
      var src = $("sa-d-src"); src.textContent = "";
      if (a.src && a.src.length) { src.appendChild(document.createTextNode("Sources: ")); a.src.forEach(function (s, i) { if (i) src.appendChild(document.createTextNode("; ")); var l = document.createElement("a"); l.href = s.url; l.target = "_blank"; l.rel = "noopener"; l.textContent = s.t + (s.ref ? " (" + s.ref + ")" : ""); src.appendChild(l); }); }
    }
    $("sa-d-zoom").addEventListener("click", function () { var a = byId[selId]; if (a && a.box) fitBox(a.box); });
    $("sa-d-copy").addEventListener("click", function () {
      var a = byId[selId]; if (!a || !a.pts.length) return;
      copyText(a.title + "\n" + a.pts.map(function (p) { return p.n + "  " + Geo.lat(p.la) + "  " + Geo.lon(p.lo) + "  " + p.nm + (p.inf ? "  (coast point, not official)" : ""); }).join("\n"));
    });
    function sheetCheck() {
      var body = $("sa-sheet-body"); body.textContent = "";
      var bad = SA_SHEET.filter(function (s) { return s.sev !== "ok"; }), good = SA_SHEET.length - bad.length;
      var p = document.createElement("p"); p.className = "u-mt-0";
      p.textContent = "Every point of your sheet was compared with the official coordinates: " + good + " of " + SA_SHEET.length + " agree within 1 NM (differences in the last decimal place only). " + bad.length + " need a look:";
      body.appendChild(p);
      var wrapT = document.createElement("div"); wrapT.className = "tbl-scroll"; var t = document.createElement("table"); t.className = "dt sa-ptbl sa-cmp";
      var th = document.createElement("thead"), hr = document.createElement("tr"); ["List and row", "Your sheet", "Official", "Difference", "What it means"].forEach(function (h) { hr.appendChild(cellTxt("th", h)); }); th.appendChild(hr); t.appendChild(th);
      var tb = document.createElement("tbody");
      bad.forEach(function (s) {
        var tr = document.createElement("tr");
        tr.appendChild(cellTxt("td", s.list + ", row " + s.row, "wrap"));
        tr.appendChild(cellTxt("td", Geo.lat(s.la) + " " + Geo.lon(s.lo), "num"));
        tr.appendChild(cellTxt("td", Geo.lat(s.off.la) + " " + Geo.lon(s.off.lo) + (s.off.official ? "" : " (coast point)"), "num"));
        tr.appendChild(cellTxt("td", (s.d >= 10 ? Math.round(s.d) : s.d.toFixed(1)) + " NM", "num"));
        var td = document.createElement("td"); td.className = "wrap"; var tag = document.createElement("span"); tag.className = "sa-tag " + (s.sev === "error" ? "inf" : s.sev === "check" ? "inf" : ""); tag.textContent = s.sev === "error" ? "ERROR" : s.sev === "check" ? "CHECK" : "NOTE"; td.appendChild(tag); td.appendChild(document.createTextNode(" " + s.txt)); tr.appendChild(td);
        tr.addEventListener("click", function () { showSheet = true; $("sa-sheet-show").checked = true; save(); fitBox([Math.min(s.lo, s.off.lo) - 2, Math.min(s.la, s.off.la) - 2, Math.max(s.lo, s.off.lo) + 2, Math.max(s.la, s.off.la) + 2]); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrapT.appendChild(t); body.appendChild(wrapT);
      var lab = document.createElement("label"); lab.className = "sa-join"; var cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "sa-sheet-show"; cb.checked = showSheet; lab.appendChild(cb); lab.appendChild(document.createTextNode(" Show the points of my sheet on the chart (squares, with the row number)")); body.appendChild(lab);
      cb.addEventListener("change", function () { showSheet = cb.checked; save(); draw(); });
      var n = document.createElement("p"); n.className = "small muted u-mt-2h"; n.textContent = "Click a line to see it on the chart. Official points come from the IMO regulations (MEPC.201(62), MEPC.361(79) and others, see each area's sources). Lines marked CHECK are worth correcting in your sheet before it is used for a passage plan."; body.appendChild(n);
    }

    /* ---------- my positions ---------- */
    function dmParts(v) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 600) / 10; if (m >= 60) { d++; m = 0; } return { d: String(d), m: String(m) }; }
    function rowsDraw(keepFocus) {
      var box = $("sa-pos-rows"); box.textContent = "";
      pos.forEach(function (p, i) {
        var row = document.createElement("div"); row.className = "sa-pos-row";
        var top = document.createElement("div"); top.className = "sa-pn";
        var num = document.createElement("span"); num.className = "sa-num"; num.textContent = String(i + 1);
        var nm = document.createElement("input"); nm.type = "text"; nm.className = "text-input"; nm.placeholder = "Name (optional)"; nm.maxLength = 30; nm.value = p.name || ""; nm.setAttribute("aria-label", "Name of position " + (i + 1));
        var x = document.createElement("button"); x.type = "button"; x.className = "sa-x"; x.textContent = "×"; x.title = "Delete this position"; x.setAttribute("aria-label", "Delete position " + (i + 1));
        top.appendChild(num); top.appendChild(nm); top.appendChild(x); row.appendChild(top);
        function fld(isLat) {
          var f = document.createElement("div"); f.className = "sa-fld"; var v = isLat ? p.lat : p.lon, pp = dmParts(v);
          var d = document.createElement("input"); d.type = "text"; d.className = "text-input"; d.inputMode = "decimal"; d.value = pp.d; d.maxLength = 3; d.placeholder = isLat ? "Lat °" : "Lon °"; d.setAttribute("aria-label", (isLat ? "Latitude" : "Longitude") + " degrees, position " + (i + 1));
          var m = document.createElement("input"); m.type = "text"; m.className = "text-input"; m.inputMode = "decimal"; m.value = pp.m; m.maxLength = 6; m.placeholder = "min'"; m.setAttribute("aria-label", (isLat ? "Latitude" : "Longitude") + " minutes, position " + (i + 1));
          var h = document.createElement("select"); h.className = "text-input"; (isLat ? ["N", "S"] : ["E", "W"]).forEach(function (t) { var o = document.createElement("option"); o.value = t; o.textContent = t; h.appendChild(o); }); h.value = v < 0 ? (isLat ? "S" : "W") : (isLat ? "N" : "E"); h.setAttribute("aria-label", isLat ? "North or South" : "East or West");
          f.appendChild(d); f.appendChild(m); f.appendChild(h);
          function upd() {
            var dd = parseFloat(d.value.replace(",", ".")), mm = m.value.trim() === "" ? 0 : parseFloat(m.value.replace(",", ".")), max = isLat ? 90 : 180;
            var bad = isNaN(dd) || isNaN(mm) || dd < 0 || dd > max || mm < 0 || mm >= 60 || (dd === max && mm > 0);
            d.setAttribute("aria-invalid", bad ? "true" : "false"); m.setAttribute("aria-invalid", bad ? "true" : "false");
            if (bad) { p[isLat ? "bad1" : "bad2"] = true; } else { p[isLat ? "bad1" : "bad2"] = false; var val = dd + mm / 60; if (h.value === "S" || h.value === "W") val = -val; p[isLat ? "lat" : "lon"] = val; }
            refreshPos();
          }
          d.addEventListener("input", upd); m.addEventListener("input", upd); h.addEventListener("change", upd);
          return f;
        }
        row.appendChild(fld(true)); row.appendChild(fld(false));
        var res = document.createElement("div"); res.className = "sa-res"; res.id = "sa-res-" + i; row.appendChild(res);
        nm.addEventListener("input", function () { p.name = nm.value; save(); schedule(); });
        x.addEventListener("click", function () { pos.splice(i, 1); save(); rowsDraw(); refreshPos(); });
        box.appendChild(row);
      });
      refreshPos();
    }
    function refreshPos() {
      pos.forEach(function (p, i) {
        var el = $("sa-res-" + i); if (!el) return;
        if (p.bad1 || p.bad2) { el.textContent = "Check the degrees and minutes (latitude 0 to 90, longitude 0 to 180, minutes under 60)."; el.className = "sa-res bad"; return; }
        el.className = "sa-res"; resultHtml(check(p.lat, p.lon), el);
      });
      save(); draw();
    }
    function addPos(name, lat, lon) {
      if (pos.length >= 60) { toast("Up to 60 positions"); return; }
      pos.push({ name: (name || "").slice(0, 30), lat: lat, lon: lon }); save(); rowsDraw(); schedule();
    }
    $("sa-pos-add").addEventListener("click", function () {
      var c = view ? { lat: latAt(H / 2), lon: ((lonAt(W / 2) + 180) % 360 + 360) % 360 - 180 } : { lat: 0, lon: 0 };
      addPos("", Math.round(c.lat * 60) / 60, Math.round(c.lon * 60) / 60);
      var inp = $("sa-pos-rows").querySelectorAll(".sa-pos-row"); var last = inp[inp.length - 1]; if (last) last.querySelector("input.text-input").focus();
    });
    $("sa-pos-clear").addEventListener("click", function () { if (!pos.length) return; if (!window.confirm("Remove all " + pos.length + " positions?")) return; pos = []; save(); rowsDraw(); draw(); });
    $("sa-pos-copy").addEventListener("click", function () {
      if (!pos.length) { toast("No positions to copy"); return; }
      copyText(pos.map(function (p, i) { var r = check(p.lat, p.lon); return (i + 1) + "  " + (p.name ? p.name + "  " : "") + Geo.lat(p.lat) + "  " + Geo.lon(p.lon) + "  " + (r.ins.length ? "inside " + r.ins.map(function (a) { return a.title; }).join(", ") : "outside all listed areas"); }).join("\n"));
    });
    $("sa-join").checked = join; $("sa-join").addEventListener("change", function () { join = $("sa-join").checked; save(); draw(); });
    $("sa-paste-go").addEventListener("click", function () {
      var lines = $("sa-paste-text").value.split(/\r?\n/).filter(function (l) { return l.trim(); }), ok = 0, bad = [];
      lines.forEach(function (l, i) { var r = Geo.parse(l); if (r.error) bad.push("Line " + (i + 1) + ": " + r.error); else if (pos.length < 60) { pos.push({ name: (r.name || "").slice(0, 30), lat: r.lat, lon: r.lon }); ok++; } });
      var msg = $("sa-paste-msg");
      if (bad.length) { msg.className = "hint error"; msg.textContent = (ok ? ok + " added. " : "") + bad.join(" · "); } else { msg.className = "hint"; msg.textContent = ok ? ok + " position" + (ok > 1 ? "s" : "") + " added." : "Nothing to add."; if (ok) $("sa-paste-text").value = ""; }
      if (ok) { save(); rowsDraw(); schedule(); if (view && pos.length) $("sa-fitpos").click(); }
    });

    /* ---------- print ---------- */
    function fillPrint() {
      var sh = Ships.active(), a = byId[selId];
      fillCells($("sa-ps-info"), [["Ship", sh ? sh.name : "—"], ["IMO number", sh && sh.imo ? sh.imo : "—"], ["Printed", new Date().toISOString().slice(0, 10)], ["Chart centre", view ? Geo.lat(latAt(H / 2)) + " " + Geo.lon(lonAt(W / 2)) : "—"]]);
      try { $("sa-ps-map").src = cv.toDataURL("image/png"); } catch (e) {}
      var t = $("sa-ps-pos"); t.textContent = "";
      var hd = document.createElement("tr"); ["No.", "Name", "Latitude", "Longitude", "Areas"].forEach(function (h) { hd.appendChild(cellTxt("th", h)); }); var th = document.createElement("thead"); th.appendChild(hd); t.appendChild(th);
      var tb = document.createElement("tbody"); pos.forEach(function (p, i) { var r = check(p.lat, p.lon), tr = document.createElement("tr"); tr.appendChild(cellTxt("td", String(i + 1))); tr.appendChild(cellTxt("td", p.name || "")); tr.appendChild(cellTxt("td", Geo.lat(p.lat))); tr.appendChild(cellTxt("td", Geo.lon(p.lon))); tr.appendChild(cellTxt("td", r.ins.length ? "Inside: " + r.ins.map(function (x) { return x.title; }).join("; ") : "Outside all listed areas", "wrap")); tb.appendChild(tr); }); t.appendChild(tb);
      var t2 = $("sa-ps-pts"); t2.textContent = ""; $("sa-ps-area-h").textContent = a ? a.title : "Selected area";
      if (a && a.pts.length) {
        var h2 = document.createElement("tr"); ["No.", "Point", "Latitude", "Longitude", "Source"].forEach(function (h) { h2.appendChild(cellTxt("th", h)); }); var th2 = document.createElement("thead"); th2.appendChild(h2); t2.appendChild(th2);
        var tb2 = document.createElement("tbody"); a.pts.slice(0, 60).forEach(function (p) { var tr = document.createElement("tr"); [p.n, p.nm, Geo.lat(p.la), Geo.lon(p.lo), p.inf ? "coast point" : "official"].forEach(function (v) { tr.appendChild(cellTxt("td", v, "wrap")); }); tb2.appendChild(tr); }); t2.appendChild(tb2);
      }
    }
    $("sa-print").addEventListener("click", function () { fillPrint(); window.print(); });
    window.addEventListener("beforeprint", function () { if (location.hash === "#special-areas") fillPrint(); });

    /* ---------- start ---------- */
    loadColors();
    new MutationObserver(function () { loadColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", resize);
    renderList(); renderDetail(); rowsDraw(); sheetCheck();
    resize();
    if (!st.view) { var a0 = byId[selId]; if (a0 && a0.box) fitBox(a0.box); }
    Ships.onChange(function () { if (started["special-areas"]) fillPrint(); });
  }

