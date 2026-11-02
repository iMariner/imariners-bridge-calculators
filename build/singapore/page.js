  /* Tool: Singapore Strait reporting chart. Data SGS from data/singapore.packed.json (build/singapore/build.py); sources in data/singapore/research-*.json */
  function initSingapore() {
    var D = SGS, KEY = "bridgeCalc.sgs", map = null, mark = null;
    var st = isObj(store.get(KEY)) ? store.get(KEY) : {};
    if (!isObj(st.ly)) st.ly = { sr: true, tss: true, port: true, lim: true, bg: true, pts: true };
    if (["east", "west", "arr", "dep"].indexOf(st.tab) < 0) st.tab = "east";
    if (!isObj(st.ship)) st.ship = {};                              /* line P and Q/R per ship */
    if (st.ship._ === undefined && (typeof st.haz === "string" || typeof st.def === "string")) st.ship._ = { haz: st.haz || "", def: st.def || "" };
    function shipVals() { var k = shipSlot(st.ship); if (!isObj(st.ship[k])) st.ship[k] = { haz: "", def: "" }; return st.ship[k]; }
    function save() { var v = shipVals(); v.haz = $("sg-haz").value; v.def = $("sg-def").value; store.set(KEY, { ly: st.ly, tab: st.tab, pos: st.pos || "", ship: st.ship, view: st.view || null }); }
    function dec(a) { var o = new Array(a.length), x = 0, y = 0; for (var i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; o[i] = x / 1e4; o[i + 1] = y / 1e4; } return o; }
    function flat(pts) { var o = []; pts.forEach(function (p) { o.push(p[0], p[1]); }); return o; }
    function boxOf(r) { var b = [1e9, 1e9, -1e9, -1e9]; for (var i = 0; i < r.length; i += 2) { b[0] = Math.min(b[0], r[i]); b[2] = Math.max(b[2], r[i]); b[1] = Math.min(b[1], r[i + 1]); b[3] = Math.max(b[3], r[i + 1]); } return b; }

    /* ---------- data ---------- */
    var PS = D.portSectors.map(function (s) { var g = s.rings.map(function (poly) { return poly.map(dec); }); return { s: s, g: g, b: boxOf([].concat.apply([], g.map(function (p) { return p[0]; }))) }; });
    var LIMIT = flat(D.portLimit.p), TIA = flat(D.tia.p);
    var VTS = { 6: { n: "Johor VTS", ch: "VHF 88", who: "Marine Department Malaysia" }, 7: { n: "VTIS West", ch: "VHF 73", who: "Singapore VTS" }, 8: { n: "VTIS Central", ch: "VHF 14", who: "Singapore VTS" }, 9: { n: "VTIS East", ch: "VHF 10", who: "Singapore VTS" } };
    var L = D.sr.line.p, LON7 = D.sr.lons[0].lon, LON8 = D.sr.lons[1].lon, LON9 = D.sr.lons[2].lon;
    function westOfLine(lon, lat) { var a = L[1], b = L[0]; return (b[0] - a[0]) * (lat - a[1]) - (b[1] - a[1]) * (lon - a[0]) > 0; }   /* left of Karimun -> Piai = sector 6 side */
    function lineLonAt(lat) { var a = L[1], b = L[0]; return a[0] + (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]); }
    function onChart(lon, lat) { var b = D.bounds; return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]; }
    var PTP = D.johor.filter(function (j) { return /Pelepas/.test(j.name); }).map(function (j) { return flat(j.p); });
    function johorWaters(lon, lat) {                                /* the Johor Strait and the Pulai river (Tanjung Pelepas, north of Tg Piai) are not part of STRAITREP */
      if (lat > L[0][1] && PTP.some(function (r) { return Geo.pointInRing(lon, lat, r); })) return true;   /* Pasir Gudang's limits reach over the TSS, so they are not used */
      var ps = portSectorAt(lon, lat); return !!ps && / Johor Strait /.test(ps.name + " ");
    }
    function sectorAt(lon, lat) { if (!onChart(lon, lat) || johorWaters(lon, lat)) return 0; if (westOfLine(lon, lat)) return 6; if (lon < LON7) return 7; if (lon < LON8) return 8; if (lon < LON9) return 9; return 0; }
    function inPoly(g, lon, lat) { if (!Geo.pointInRing(lon, lat, g[0])) return false; for (var i = 1; i < g.length; i++) if (Geo.pointInRing(lon, lat, g[i])) return false; return true; }
    function portSectorAt(lon, lat) { for (var i = 0; i < PS.length; i++) { var p = PS[i]; if (lon < p.b[0] || lon > p.b[2] || lat < p.b[1] || lat > p.b[3]) continue; for (var k = 0; k < p.g.length; k++) if (inPoly(p.g[k], lon, lat)) return p.s; } return null; }
    function nm(a, b) { var r = WGS84.rhumb(a[1], a[0], b[1], b[0]); return r; }
    function p3(n) { return ("00" + Math.round(n) % 360).slice(-3); }

    /* lane arrows: at the middle of each lane limit, half way to its scheme's separation zone or line, pointing the lane's way */
    var ARROWS = [];
    D.tss.forEach(function (t) {
      if (t.k !== "ll" || !t.dir) return;
      var seps = D.tss.filter(function (u) { return u.s === t.s && (u.k === "sz" || u.k === "sl"); }); if (!seps.length) return;
      for (var i = 0; i + 1 < t.p.length; i++) {
        var a = t.p[i], b = t.p[i + 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], best = null, bd = 1e9;
        seps.forEach(function (u) { u.p.forEach(function (q, j) { var r = u.p[(j + 1) % u.p.length], c = closest(m, q, r), d = Math.pow(c[0] - m[0], 2) + Math.pow(c[1] - m[1], 2); if (d < bd) { bd = d; best = c; } }); });
        if (!best || bd > 0.0016) continue;
        var dx = b[0] - a[0], dy = b[1] - a[1]; if ((t.dir === "W" && dx > 0) || (t.dir === "E" && dx < 0)) { dx = -dx; dy = -dy; }
        ARROWS.push({ p: [(m[0] + best[0]) / 2, (m[1] + best[1]) / 2], dx: dx, dy: dy });
      }
    });
    function closest(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1); t = Math.max(0, Math.min(1, t)); return [a[0] + t * dx, a[1] + t * dy]; }

    /* ---------- the chart ---------- */
    function on(k) { return st.ly[k] !== false; }
    function poly(api, pts, close) { var ctx = api.ctx(); ctx.beginPath(); pts.forEach(function (p, i) { var x = api.X(p[0]), y = api.Y(p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); if (close) ctx.closePath(); }
    function under(api) {
      var ctx = api.ctx(), b = D.bounds, nN = 1.6, sS = 0.8;
      if (on("sr")) {                                              /* STRAITREP sector bands, light tints so the TSS reads on top */
        var xN = lineLonAt(nN), xS = lineLonAt(sS), bands = [[[b[0] - 1, sS], [xS, sS], [xN, nN], [b[0] - 1, nN]], [[xS, sS], [LON7, sS], [LON7, nN], [xN, nN]], [[LON7, sS], [LON8, sS], [LON8, nN], [LON7, nN]], [[LON8, sS], [LON9, sS], [LON9, nN], [LON8, nN]]];
        bands.forEach(function (q, i) { ctx.fillStyle = api.alpha(api.C.true, i % 2 ? 0.07 : 0.03); poly(api, q, true); ctx.fill(); });
      }
      if (on("port")) {
        PS.forEach(function (p, i) { ctx.fillStyle = api.alpha(api.C.accent, i % 2 ? 0.16 : 0.09); p.g.forEach(function (g) { ctx.beginPath(); g.forEach(function (r) { api.ring(r, 0); }); ctx.fill("evenodd"); }); });
      }
    }
    function label(api, text, x, y, opt) {
      var ctx = api.ctx(); opt = opt || {}; ctx.font = (opt.bold ? "600 " : "") + (opt.size || 11) + "px " + api.C.font; ctx.textBaseline = "middle"; ctx.textAlign = opt.align || "left";
      var w = ctx.measureText(text).width, x0 = opt.align === "center" ? x - w / 2 : x;
      if (opt.box) { ctx.fillStyle = api.alpha(api.C.sea, 0.88); ctx.fillRect(x0 - 3, y - 8, w + 6, 16); }   /* sea colour: dark at night */
      ctx.fillStyle = opt.color || api.C.ink; ctx.fillText(text, x, y);
    }
    function layers(api) {
      var ctx = api.ctx(), X = api.X, Y = api.Y, s = api.scale(), W = api.W(), H = api.H(), tss = api.C["map-tss"];
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (on("lim")) {
        ctx.strokeStyle = api.C["area-eca"]; ctx.lineWidth = 1.6; ctx.setLineDash([7, 4]); ctx.beginPath(); api.ring(LIMIT, 0); ctx.stroke();
        ctx.strokeStyle = api.C.rose; ctx.lineWidth = 1.3; D.johor.forEach(function (j) { poly(api, j.p, false); ctx.stroke(); });
        ctx.setLineDash([]);
      }
      if (on("port")) {
        ctx.strokeStyle = api.alpha(api.C.accent, 0.8); ctx.lineWidth = 1; PS.forEach(function (p) { p.g.forEach(function (g) { ctx.beginPath(); api.ring(g[0], 0); ctx.stroke(); }); });
        ctx.setLineDash([3, 3]); ctx.strokeStyle = api.C.accent; ctx.beginPath(); api.ring(TIA, 0); ctx.stroke(); ctx.setLineDash([]);
        if (s > 2600) PS.forEach(function (p) { var x = X(p.s.lab[0]), y = Y(p.s.lab[1]); label(api, p.s.st + " " + p.s.ch.replace(/^VHF /, "Ch ").replace(/ \(.*$/, ""), x, y, { align: "center", box: true, size: 10, color: api.C.accent, bold: true }); });
      }
      if (on("tss")) {
        D.tss.forEach(function (t) {
          ctx.strokeStyle = tss; ctx.lineWidth = t.k === "sl" ? 2 : 1.3; ctx.setLineDash(t.k === "ll" || t.k === "pa" ? [8, 5] : t.k === "dw" ? [3, 4] : t.k === "an" ? [5, 3] : []);
          if (t.k === "fp") { var c = t.p[0]; ctx.beginPath(); ctx.arc(X(c[0]), Y(c[1]), Math.max(2.5, 0.000833 * s), 0, 7); ctx.stroke(); return; }
          poly(api, t.p, t.c);
          if (t.k === "sz") { ctx.fillStyle = api.alpha(tss, 0.3); ctx.fill(); }
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ARROWS.forEach(function (a) {                              /* lane direction */
          var x = X(a.p[0]), y = Y(a.p[1]), ang = Math.atan2(-(Y(a.p[1] + a.dy) - y), X(a.p[0] + a.dx) - x), len = 13;
          ctx.save(); ctx.translate(x, y); ctx.rotate(-ang); ctx.strokeStyle = tss; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.moveTo(len - 6, -4.5); ctx.lineTo(len, 0); ctx.lineTo(len - 6, 4.5); ctx.stroke(); ctx.restore();
        });
        if (s > 1500) D.tss.forEach(function (t) {
          if (t.k !== "dw" && t.k !== "pa") return;
          var cx = 0, cy = 0; t.p.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= t.p.length; cy /= t.p.length;
          label(api, t.k === "dw" ? "DW" : "Precautionary area", X(cx), Y(cy), { align: "center", size: 10, color: tss, bold: true });
        });
      }
      if (on("sr")) {
        ctx.strokeStyle = api.C.true; ctx.lineWidth = 2.4; poly(api, L, false); ctx.stroke();
        ctx.setLineDash([10, 5]); ctx.lineWidth = 1.8;
        D.sr.lons.forEach(function (l) { ctx.beginPath(); ctx.moveTo(X(l.lon), 0); ctx.lineTo(X(l.lon), H); ctx.stroke(); });
        ctx.setLineDash([]);
        var yc = H - 42, xl = X(lineLonAt(api.latAt(yc))), xs = [[0, xl], [xl, X(LON7)], [X(LON7), X(LON8)], [X(LON8), X(LON9)]];
        [6, 7, 8, 9].forEach(function (n, i) {                     /* sector chips along the bottom of the chart */
          var a = Math.max(xs[i][0], 4), b2 = Math.min(xs[i][1], W - 4); if (b2 - a < 70) return;
          var v = VTS[n], t = "Sector " + n + " · " + v.n + " · " + v.ch.replace("VHF ", "Ch ");
          ctx.font = "600 11px " + api.C.font; var w = ctx.measureText(t).width; if (w + 12 > b2 - a) t = n + " · " + v.ch.replace("VHF ", "Ch "), w = ctx.measureText(t).width;
          var x = (a + b2) / 2, y = yc; ctx.fillStyle = api.alpha(api.C.sea, 0.94); ctx.fillRect(x - w / 2 - 6, y - 10, w + 12, 20); ctx.strokeStyle = api.C.true; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 - 6, y - 10, w + 12, 20);
          label(api, t, x, y, { align: "center", bold: true, color: api.C.true });
        });
        D.sr.lons.forEach(function (l) { label(api, l.txt, X(l.lon) + 4, 30, { size: 10, box: true, color: api.C.true }); });
      }
      if (on("pts")) {
        D.sr.refs.forEach(function (r) { var x = X(r.p[0]), y = Y(r.p[1]); ctx.fillStyle = api.C.paper; ctx.strokeStyle = api.C.ship; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5.5, y + 4); ctx.lineTo(x - 5.5, y + 4); ctx.closePath(); ctx.fill(); ctx.stroke(); var dup = D.sr.points.some(function (q) { return Math.abs(X(q.p[0]) - x) < 12 && Math.abs(Y(q.p[1]) - y) < 12; }); if (s > 600 && !dup) label(api, r.name, x + 8, y, { size: 10, box: true }); });
        D.sr.points.forEach(function (r) { var x = X(r.p[0]), y = Y(r.p[1]); ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fillStyle = api.C.ship; ctx.fill(); ctx.strokeStyle = api.C.paper; ctx.lineWidth = 2; ctx.stroke(); label(api, "R", x, y + 0.5, { align: "center", size: 8, bold: true, color: api.C.paper }); if (s > 600) label(api, r.name.replace(/ \(.*$/, ""), x + 9, y - 10, { size: 10, box: true, bold: true }); });
        if (s > 4000 && on("port")) D.uw.forEach(function (u) { var x = X(u.p[0]), y = Y(u.p[1]); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fillStyle = api.C.accent; ctx.fill(); label(api, u.name, x + 5, y, { size: 9 }); });
      }
      if (on("bg")) D.bgs.forEach(function (g) {
        var x = X(g.p[0]), y = Y(g.p[1]); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = api.C["pos-mark"]; ctx.fillRect(-4.5, -4.5, 9, 9); ctx.strokeStyle = api.C.paper; ctx.lineWidth = 1.5; ctx.strokeRect(-4.5, -4.5, 9, 9); ctx.restore();
        if (s > 750) label(api, g.code, x + 8, y + 9, { size: 10, box: true, bold: true, color: api.C["pos-mark"] });
      });
      if (mark) {                                                  /* the ship's position */
        var mx = X(mark[0]), my = Y(mark[1]); ctx.strokeStyle = api.C["pos-mark"]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.moveTo(mx - 15, my); ctx.lineTo(mx - 4, my); ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 15, my); ctx.moveTo(mx, my - 15); ctx.lineTo(mx, my - 4); ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 15); ctx.stroke();
      }
      label(api, "Coast: OpenStreetMap. Not for navigation.", W - 8, H - 12, { align: "right", size: 9, box: true, color: api.C.ink });
    }

    /* ---------- who to call at a position ---------- */
    function fmtPos(lon, lat) { return Geo.lat(lat) + "  " + Geo.lon(lon); }
    function info(lon, lat, px, py) {
      var box = $("sg-info"); while (box.firstChild) box.removeChild(box.firstChild); box.hidden = false;
      var h = document.createElement("h3"); h.textContent = fmtPos(lon, lat); box.appendChild(h);
      var dl = document.createElement("dl"); box.appendChild(dl);
      function row(k, v, strong) { var dt = document.createElement("dt"); dt.textContent = k; var dd = document.createElement("dd"); if (strong) { var b = document.createElement("b"); b.textContent = strong; dd.appendChild(b); dd.appendChild(document.createTextNode(v ? "  " + v : "")); } else dd.textContent = v; dl.appendChild(dt); dl.appendChild(dd); }
      var n = sectorAt(lon, lat);
      if (n) row("STRAITREP", "Sector " + n + ", " + VTS[n].who + ". Keep a listening watch on this channel; report here on entering the area, on leaving a port or anchorage, or before joining the traffic lane.", VTS[n].n + " " + VTS[n].ch);
      else row("STRAITREP", johorWaters(lon, lat) ? "Johor Strait or the Pulai river (Tanjung Pelepas): not part of STRAITREP. Give the STRAITREP report when you come out into the Strait: VTIS East VHF 10 at Eastern Buoy from the East Johor Strait, VTIS West VHF 73 from the west." : lon > LON9 ? "East of 104°22.9'E: outside STRAITREP (report to VTIS East VHF 10 when crossing it westbound)." : "Outside the sectors shown.");
      var ps = portSectorAt(lon, lat), inLim = Geo.pointInRing(lon, lat, LIMIT);
      if (ps) row("Port sector", ps.name + ". Ask permission before entering, moving within or leaving the sector (Channel Information Report).", ps.st + " " + ps.ch.replace(/ \(.*$/, ""));
      else row("Port", inLim ? "Inside Singapore port limits." : "Outside Singapore port limits.");
      if (Geo.pointInRing(lon, lat, TIA)) row("East Johor Strait", "Traffic Information Area: clearance and ETAs for ships of 2000 GT or more or over 30 m height. Max 12 kn.", "Sembawang Control VHF 21");
      var best = null, bd = 1e9;
      D.sr.refs.forEach(function (r) { var d = nm([lon, lat], r.p).dist; if (d < bd) { bd = d; best = r; } });
      if (best) { var rr = nm(best.p, [lon, lat]); row("For line D", p3(rr.course === null ? 0 : rr.course) + "° " + rr.dist.toFixed(1) + " NM from " + best.name + " (nearest STRAITREP reference point)"); }
      var near = [];
      if (map && px !== undefined) {
        var api = map.api;
        D.bgs.forEach(function (g) { if (Math.hypot(api.X(g.p[0]) - px, api.Y(g.p[1]) - py) < 14) near.push(g.code + " " + g.name + " (" + g.lat + " " + g.lon + "): " + g.use); });
        D.sr.points.forEach(function (r) { if (Math.hypot(api.X(r.p[0]) - px, api.Y(r.p[1]) - py) < 14) near.push(r.name + " (" + r.lat + " " + r.lon + "): " + r.rep); });
        D.sr.refs.forEach(function (r) { if (Math.hypot(api.X(r.p[0]) - px, api.Y(r.p[1]) - py) < 14) near.push(r.name + " (" + r.lat + " " + r.lon + "): STRAITREP reference point (" + r.n + ")"); });
      }
      D.tss.forEach(function (t) { if ((t.k === "sz" || t.k === "pa" || t.k === "dw") && t.c && Geo.pointInRing(lon, lat, flat(t.p))) near.push((t.k === "sz" ? "Separation zone" : t.k === "pa" ? "Precautionary area" : "Deep water route") + ": " + t.s); });
      if (near.length) { var ul = document.createElement("ul"); ul.className = "sg-near"; near.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); box.appendChild(ul); }
      writeMsg();
    }
    function pick(lat, lon, px, py) { mark = [lon, lat]; $("sg-pos").value = Geo.lat(lat) + " " + Geo.lon(lon); st.pos = $("sg-pos").value; setHint("sg-pos-msg", "Type a position, or tap the chart", false, $("sg-pos")); save(); info(lon, lat, map ? map.api.X(lon) : undefined, map ? map.api.Y(lat) : undefined); if (map) map.draw(); }
    function hover(lat, lon) { var n = sectorAt(lon, lat), ps = portSectorAt(lon, lat); $("sg-cursor").textContent = fmtPos(lon, lat) + (n ? "   ·  STRAITREP " + n + ": " + VTS[n].n + " " + VTS[n].ch : "") + (ps ? "   ·  " + ps.st + " " + ps.ch.replace(/ \(.*$/, "") : ""); }
    function goPos() {
      var t = $("sg-pos").value.trim(); if (!t) { setHint("sg-pos-msg", "Type a position, or tap the chart", false, $("sg-pos")); return; }
      var g = Geo.parse(t);
      if (g.error || !onChart(g.lon, g.lat)) {
        setHint("sg-pos-msg", g.error ? "Could not read that position" : "That position is outside this chart (00°54'N to 01°30'N, 103°15'E to 104°33'E)", true, $("sg-pos"));
        mark = null; st.pos = ""; save(); $("sg-info").hidden = true; writeMsg(); if (map) map.draw(); return;
      }
      setHint("sg-pos-msg", "Type a position, or tap the chart", false, $("sg-pos")); mark = [g.lon, g.lat]; st.pos = t; save();
      if (map) { map.fitBox([g.lon - 0.08, g.lat - 0.05, g.lon + 0.08, g.lat + 0.05], 1); info(g.lon, g.lat, map.api.X(g.lon), map.api.Y(g.lat)); } else info(g.lon, g.lat);
    }

    /* ---------- reports in order (MSC.73(69) para 3.3 and 4.2; MPA "Vessels arriving in Singapore"; MPA PC 06/2021, 08/2026, 14/2024) ---------- */
    var P = {}; D.sr.points.concat(D.sr.refs).forEach(function (r) { P[r.name] = r.p; });
    function pt(name) { for (var k in P) if (k.indexOf(name) === 0) return P[k]; return null; }
    var STEPS = {
      east: { note: "From the Malacca Strait to the South China Sea. You have already reported to Klang VTS on entering STRAITREP at 100°40'E.", list: [
        { w: "In sector 6 (west of the Tg Piai to Pulau Karimun Kecil line)", c: "Johor VTS VHF 88", t: "Listening watch.", info: true, at: [103.40, 1.20] },
        { w: "Calling at Singapore only: Pulau Iyu Kechil abeam (still in sector 6)", c: "VTIS West VHF 73", t: "Confirmation of Arrival (MPA): ETA at the first destination or the pilot boarding ground. Ships passing through do not give this.", at: pt("Pulau Iyu Kechil") },
        { w: "Crossing the line Tg Piai to Pulau Karimun Kecil (sector 7)", c: "VTIS West VHF 73", t: "STRAITREP report: A ship, C or D position, P hazardous cargo, Q or R defects or pollution.", at: [103.47, 1.21] },
        { w: "Phillip Channel deep water route (from 103°38.9'E)", c: "VTIS West VHF 73", t: "Eastbound deep-draught ships use the deep water route and, as far as practicable, do not overtake. Deep-draught ships and VLCCs: 12 kn. UKC at least 3.5 m in the whole Straits.", info: true, at: [103.68, 1.10] },
        { w: "Passing 103°44.5'E (sector 8)", c: "VTIS Central VHF 14", t: "Change channel and keep a listening watch.", info: true, at: [LON7, 1.16] },
        { w: "Passing 104°02.1'E (sector 9)", c: "VTIS East VHF 10", t: "Change channel and keep a listening watch.", info: true, at: [LON8, 1.25] },
        { w: "Passing 104°22.9'E near Horsburgh Lt", c: "None required", t: "You leave STRAITREP. The IMO text has no leaving report; follow any VTIS request.", info: true, at: pt("Horsburgh") }] },
      west: { note: "From the South China Sea into the Strait.", list: [
        { w: "Calling at Singapore only: Horsburgh Lt abeam (just east of 104°22.9'E)", c: "VTIS East VHF 10", t: "Confirmation of Arrival (MPA): ETA at the first destination or the pilot boarding ground. Ships passing through do not give this.", at: pt("Horsburgh") },
        { w: "Crossing 104°22.9'E (sector 9)", c: "VTIS East VHF 10", t: "STRAITREP report: A ship, C or D position, P hazardous cargo, Q or R defects or pollution.", at: [LON9, 1.30] },
        { w: "From the south via Selat Riau: Karang Galang Lt abeam", c: "VTIS East VHF 10", t: "STRAITREP report on entering.", at: pt("Karang Galang") },
        { w: "Passing 104°02.1'E (sector 8)", c: "VTIS Central VHF 14", t: "Change channel and keep a listening watch.", info: true, at: [LON8, 1.25] },
        { w: "Passing 103°44.5'E (sector 7)", c: "VTIS West VHF 73", t: "Change channel and keep a listening watch.", info: true, at: [LON7, 1.16] },
        { w: "Crossing the Tg Piai to Pulau Karimun Kecil line (sector 6)", c: "Johor VTS VHF 88", t: "Listening watch. Then Klang VTS sectors 5 to 1 up the Malacca Strait.", info: true, at: [103.47, 1.21] }] },
      arr: { note: "Calling at Singapore. Send the pre-arrival notices first (see Before arrival).", list: [
        { w: "At the VTIS reporting point: Horsburgh Lt, Karang Galang Lt or Eastern Buoy abeam (from the east or south), Pulau Iyu Kechil or Pulau Jangkat Bn abeam (from the west or Selat Durian)", c: "VTIS East VHF 10 / VTIS West VHF 73", t: "Confirmation of Arrival: name, call sign, position, persons on board (passenger ships), ETA at first destination or the pilot boarding ground, height if changed. If you are also entering the STRAITREP area, give the STRAITREP report too (it adds P hazardous cargo and Q or R defects or pollution).", at: pt("Horsburgh") },
        { w: "Before entering port limits or a port sector", c: "Sector control station", t: "Channel Information Report and permission: name or call sign, draft, position, destination, height. East Control Ch 12, Keppel or Cruise Bay Ch 05, Pasir Panjang Ch 18, Sinki or West Control Ch 68, Jurong Ch 22, Sembawang Ch 21.", at: [103.86, 1.23] },
        { w: "Under way in the port", c: "Sector control station", t: "Underway Report when passing each port reporting point; continuous watch on the sector channel.", info: true },
        { w: "At the pilot boarding ground (PEBGA, PEBGB tankers, PEBGC, PWBGA, PWBGB, PSBG, PJSB, PGBG)", c: "Singapore Pilots VHF 20", t: "Pilot ordered through PSA Marine.", at: [103.89, 1.225] },
        { w: "On arrival at berth or anchorage", c: "Sector control station", t: "Arrival Report: time, berth or anchorage name, and for an anchorage bearing and distance from Eastern Buoy, Amber Beacon, Rimau Beacon or Sultan Shoal Lt. Keep VHF watch at anchor." },
        { w: "Within 24 h of arrival", c: "digitalPORT@SG", t: "Arrival General Declaration (by the agent or master)." }] },
      dep: { note: "Leaving a Singapore berth or anchorage.", list: [
        { w: "Before departure", c: "digitalPORT@SG", t: "Departure General Declaration; the Port Clearance Certificate is valid 48 h." },
        { w: "Before moving or leaving the berth, anchorage or sector", c: "Sector control station", t: "Channel Information Report and permission (draft, position, destination, height, next port)." },
        { w: "Under way in port", c: "Sector control station", t: "Underway Report at each port reporting point.", info: true },
        { w: "Leaving the port or anchorage, before joining the traffic lane", c: "VTIS of the sector: West VHF 73 / Central VHF 14 / East VHF 10", t: "STRAITREP report (para 3.3.1): A, C or D, P, Q or R. Between 103°44.5'E and 104°02.1'E it is VTIS Central VHF 14.", at: [103.9, 1.2] },
        { w: "West Johor Strait or East Johor Strait", c: "Jurong Control VHF 22 / Sembawang Control VHF 21", t: "West Johor Strait: every ship reports before entering and before leaving. East Johor Strait: ships of 2000 GT or more or over 30 m height need clearance and give ETAs at the reporting points.", at: [103.98, 1.38] }] }
    };
    function renderSteps() {
      var s = STEPS[st.tab], ol = $("sg-steps"); $("sg-tabnote").textContent = s.note; while (ol.firstChild) ol.removeChild(ol.firstChild);
      s.list.forEach(function (x) {
        var li = document.createElement("li"); if (x.info) li.className = "sg-info-step";
        var w = document.createElement("span"); w.className = "sg-where"; w.textContent = x.w; li.appendChild(w);
        var c = document.createElement("span"); c.className = "sg-call"; var b = document.createElement("b"); b.textContent = x.c; c.appendChild(b); li.appendChild(c);
        var t = document.createElement("span"); t.className = "sg-what"; t.textContent = x.t; li.appendChild(t);
        if (x.at) { var btn = document.createElement("button"); btn.type = "button"; btn.className = "btn sg-show"; btn.textContent = "Show on chart"; btn.addEventListener("click", function () { if (map) { map.fitBox([x.at[0] - 0.12, x.at[1] - 0.07, x.at[0] + 0.12, x.at[1] + 0.07], 1); $("sg-wrap").scrollIntoView({ block: "center" }); } }); li.appendChild(btn); }
        ol.appendChild(li);
      });
    }

    /* ---------- STRAITREP message ---------- */
    var FMT = [["A", "Ship: name, call sign, IMO number"], ["C / D", "Position: latitude and longitude (C), or true bearing and distance from a reference point (D)"], ["P", "Hazardous cargo: yes or no, and the class"], ["Q / R", "Defects, damage, deficiencies or limitations (Q); pollution or dangerous goods lost overboard (R)"], ["E, F", "Course and speed: only when VTIS asks"]];
    function writeMsg() {
      var s = Ships.active(), name = s && s.name ? s.name.toUpperCase() : "(SHIP)", cs = s && s.callsign ? s.callsign : "(CALL SIGN)", imo = s && s.imo ? "IMO " + s.imo : "IMO (number)";
      var n = mark ? sectorAt(mark[0], mark[1]) : 0; if (!n && mark && mark[0] > LON9) n = 9;   /* east of the limit: the report on entering goes to VTIS East */
      if (!n && mark && johorWaters(mark[0], mark[1])) { var jp = portSectorAt(mark[0], mark[1]); n = jp && /East Johor/.test(jp.name) ? 9 : 7; }   /* coming out of the Johor Strait or the Pulai river */
      var v = VTS[n] || { n: "VTIS (sector)", ch: "(sector channel)" }, pos = "(position)", dpos = "";
      if (mark) {
        pos = Geo.lat(mark[1]) + " " + Geo.lon(mark[0]);
        var best = null, bd = 1e9; D.sr.refs.forEach(function (r) { var d = nm(mark, r.p).dist; if (d < bd) { bd = d; best = r; } });
        if (best) { var rr = nm(best.p, mark); dpos = p3(rr.course === null ? 0 : rr.course) + " degrees " + rr.dist.toFixed(1) + " miles from " + best.name; }
      }
      var haz = $("sg-haz").value.trim() || "No", def = $("sg-def").value.trim() || "Nil";
      $("sg-msg").textContent = v.n + ", " + v.n + ", this is " + name + ", " + name + ", call sign " + cs + ", on " + v.ch + ".\n" +
        "Alfa: " + name + ", " + cs + ", " + imo + ".\n" +
        "Charlie: " + pos + (dpos ? "  (or Delta: " + dpos + ")" : "") + ".\n" +
        "Papa: hazardous cargo " + haz + ".\n" +
        "Quebec: " + def + ".";
    }

    /* ---------- tables and lists ---------- */
    var CH = [
      ["STRAITREP (IMO MSC.73(69))"], ["Klang VTS, sectors 1 to 5", "Ch 66, 88, 84, 61, 88", "Malacca Strait, by sector"], ["Johor VTS, sector 6", "Ch 88", "West of the Tg Piai to P. Karimun Kecil line"],
      ["Singapore VTIS West, sector 7", "Ch 73", "To 103°44.5'E"], ["Singapore VTIS Central, sector 8", "Ch 14", "103°44.5'E to 104°02.1'E"], ["Singapore VTIS East, sector 9", "Ch 10", "104°02.1'E to 104°22.9'E"],
      ["Singapore port sectors (MPA PC 06/2021)"]];
    D.portSectors.forEach(function (s) { CH.push([s.st + " (" + s.name + ")", s.ch.replace(/^VHF /, "Ch ").replace(/ \(.*$/, ""), s.name === "East Johor Strait Sector" ? "Reserved Ch 13 (PC 08/2026)" : s.name === "West Johor Strait Sector" ? "All ships, before entering and leaving" : ""]); });
    CH.push(["Other Singapore channels (MPA)"], ["Port Operations Control", "Ch 16, 09", "Distress, urgency, safety, MSI"], ["Singapore Pilots", "Ch 20", "Pilotage"], ["Port Marine Safety", "Ch 07", "Marine emergencies"], ["Port Security", "Ch 03", "Security"], ["Immigration", "Ch 74", "Clearance"], ["Port Health", "Ch 14", "Same channel as VTIS Central"], ["Tugs, water boats", "Ch 17, 61", ""],
      ["Johor ports (Lembaga Pelabuhan Johor)"], ["Johor Port Control (Pasir Gudang)", "Ch 11", "Arrival and departure report"], ["PTP Port Control (Tanjung Pelepas)", "Ch 75 / 76", "2015 notice; the PTP website lists Ch 83 and 76: confirm with the agent"]);
    var BEFORE = [
      "Pre-Arrival Notification (PAN): ships of 500 GT and over, at least 24 h before arrival (or on leaving a port less than 24 h away). E-mail isps@mpa.gov.sg or the agent through digitalPORT@SG. It replaces the Notice of Arrival.",
      "Under 500 GT: Notice of Arrival at least 12 h before arrival, digitalPORT@SG or noa@mpa.gov.sg.",
      "Dangerous goods in packages: declaration at least 12 h before arrival (PORTNET, JP-Online or digitalPORT@SG).",
      "Bulk hazardous and noxious cargo: notification 24 h before arrival or loading, digitalPORT@SG.",
      "Single hull tankers of 5000 DWT and over: declaration to the Port Master 24 h before arrival.",
      "Arrival General Declaration within 24 h of arrival; Departure General Declaration before leaving (port clearance valid 48 h). Both through digitalPORT@SG.",
      "Pilot: order through PSA Marine; Singapore Pilots VHF 20."];
    var JOHOR = [
      "Notice of arrival at least 48 h before ETA and of departure 3 h before ETD (LPJ By-laws), now through the Malaysia Maritime Single Window (MMSW), with the Ship Call Number and pre-arrival security notice.",
      "Arrival and departure report: Johor Port Control VHF 11 (Pasir Gudang); PTP Port Control VHF 75/76 (Tanjung Pelepas; the PTP website lists 83 and 76). AIS on at all times.",
      "Port limits of Pasir Gudang (2013) and Tanjung Pelepas (2010) are drawn from the Malaysian gazettes; the gazettes give no datum."];
    var RULES = [
      "STRAITREP applies to ships of 300 GT and over, 50 m and over, tows of 300 GT or 50 m combined, any ship with hazardous cargo, and all passenger ships with VHF. Keep a listening watch on the sector channel; general broadcasts come on Ch 16 after an announcement on the sector channel.",
      "Deep-draught vessels (draught 15 m or more) and tankers of 150,000 DWT and over: under keel clearance of at least 3.5 m at all times through the Straits.",
      "Eastbound deep-draught vessels shall use the deep water routes (in the Malacca Strait, Phillip Channel and the Singapore Strait) and, in Phillip Channel and the Singapore Strait, avoid overtaking as far as practicable.",
      "Deep-draught vessels and VLCCs: max 12 kn over the ground, as far as safe and practicable, in the One Fathom Bank TSS, the deep water routes in Phillip Channel and the Singapore Strait, and the westbound lane from south of St John's Island to Raffles Lighthouse (IMO rule 7).",
      "Ships crossing the lanes to or from ports and anchorages (300 GT or 50 m and over) are recommended to show three all-round green lights vertically at night, report the intention to VTIS and cross in ample time (IMO recommendation, not mandatory).",
      "East Johor Strait (MPA PC 08/2026, from 1 Sep 2026): max 12 kn, 6 kn past the yards; no night towing between the Causeway and Angler Buoy; no stopping or anchoring in the Traffic Information Area; report ETA changes at once."];
    var SRC = [
      "IMO resolution MSC.73(69), STRAITREP (in force 1 Dec 1998, not amended; Malaysia reported a review to IMO NCSR 13 in June 2026). Its positions are on the 1998 chart datum, about 0.1' east of WGS 84: report points on this chart use MPA's WGS 84 positions.",
      "Sector limits 7 to 9 (103°44.5'E, 104°02.1'E and the eastern limit 104°22.9'E on WGS 84, 104°23'E in the IMO text) are from MPA's VTIS pages and chartlet. Sector north and south limits are not given in any official text; the IMO chartlet only. Sectors 1 to 5 and the sector 5/6 limit are not drawn.",
      "Tg Piai and Pulau Karimun Kecil are as printed in MSC.73(69) (no official WGS 84 version).",
      "Traffic separation scheme: MPA Singapore Port Information 2026 (1 Nov 2026, WGS 84), from IMO COLREG.2/Circ.44 and Circ.54 (Main Strait, with the anchorage inside the separation zone).",
      "Port limits: MPA (Port Limits) Notification S 215/2010; points 3A to 3C (2018) are suspended since 8 Apr 2019 and not drawn. Port reporting sectors and points: MPA Port Marine Circular 06/2021, drawn as the water inside their official points (coast and port limit close them). East Johor Strait: PC 08/2026. Pilot boarding grounds: Singapore Port Information 2025.",
      "Reports: MPA web pages 'Vessels arriving in Singapore' and 'Departing', PC 14/2024 (PAN), MPA dangerous goods pages. Johor: LPJ notice 6/2015 and the port by-laws. Not found officially: pilot booking times, Batam VTS rules, Johor VTS local procedures.",
      "Coastline: OpenStreetMap contributors (ODbL), simplified to about 25 m. This chart is a planning aid, not a navigational chart."];

    function fillTable(tb, rows, print) {
      while (tb.firstChild) tb.removeChild(tb.firstChild);
      var body = tb.createTBody();
      rows.forEach(function (r) { var tr = body.insertRow(); if (r.length === 1) { tr.className = "sg-grp"; var c = tr.insertCell(); c.colSpan = 3; c.textContent = r[0]; return; } r.forEach(function (t) { tr.insertCell().textContent = t; }); });
    }
    function list(ul, items) { while (ul.firstChild) ul.removeChild(ul.firstChild); items.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); }
    var tf = $("sg-fmt"); fillTable(tf, FMT);
    fillTable($("sg-ch"), CH); fillTable($("sg-ps-ch"), CH);
    list($("sg-before"), BEFORE); list($("sg-johor"), JOHOR); list($("sg-rules"), RULES); list($("sg-src"), SRC); list($("sg-ps-before"), BEFORE);
    $("sg-ps-src").textContent = "Sources: IMO MSC.73(69) STRAITREP; MPA Singapore Port Information 2026 (TSS, WGS 84); MPA VTIS pages, Port Marine Circulars 06/2021, 08/2026, 14/2024; S 215/2010 port limits. Coast: OpenStreetMap (ODbL). Planning aid, not for navigation; follow VTIS instructions and the latest notices.";
    $("sg-ps-key").textContent = "Key: teal lines and chips = STRAITREP sectors and channels (solid line Tg Piai to P. Karimun Kecil); magenta = traffic separation scheme (filled = separation zone, dashed = lane limit or precautionary area, dotted = deep water route, arrows = lane direction); blue tint = Singapore port reporting sectors; amber dashed = Singapore port limit; grey = Johor port limits; R = STRAITREP reporting point; triangle = reference point; red diamond = pilot boarding ground.";
    function printSteps() {
      var box = $("sg-ps-steps"); while (box.firstChild) box.removeChild(box.firstChild);
      [["east", "Eastbound transit"], ["west", "Westbound transit"], ["arr", "Arriving Singapore"], ["dep", "Leaving Singapore"]].forEach(function (k) {
        var d = document.createElement("div"), h = document.createElement("h4"); h.textContent = k[1]; d.appendChild(h);
        var ol = document.createElement("ol"); STEPS[k[0]].list.forEach(function (x) { var li = document.createElement("li"); li.textContent = x.w + ": " + x.c + ". " + x.t; ol.appendChild(li); }); d.appendChild(ol); box.appendChild(d);
      });
    }
    printSteps();

    /* ---------- wiring ---------- */
    Array.prototype.forEach.call(document.querySelectorAll("#sg-layers input"), function (cb) { cb.checked = on(cb.getAttribute("data-ly")); cb.addEventListener("change", function () { st.ly[cb.getAttribute("data-ly")] = cb.checked; save(); if (map) map.draw(); }); });
    var tabEl = $("sg-t-" + st.tab); if (tabEl) tabEl.checked = true;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="sg-tab"]'), function (r) { r.addEventListener("change", function () { st.tab = r.value; save(); renderSteps(); }); });
    renderSteps();
    var saved = isObj(store.get(KEY)) ? store.get(KEY) : {};
    function shipFill() { var v = shipVals(); $("sg-haz").value = v.haz || ""; $("sg-def").value = v.def || ""; }
    if (typeof saved.pos === "string") { $("sg-pos").value = saved.pos; st.pos = saved.pos; }
    shipFill();
    $("sg-haz").addEventListener("input", function () { save(); writeMsg(); }); $("sg-def").addEventListener("input", function () { save(); writeMsg(); });
    $("sg-pos").addEventListener("keydown", function (e) { if (e.key === "Enter") goPos(); });
    $("sg-pos-go").addEventListener("click", goPos);
    $("sg-copy").addEventListener("click", function () { copyText($("sg-msg").textContent); toast("Report copied"); });
    Ships.onChange(function () { shipFill(); writeMsg(); });
    var VIEWS = { all: [103.30, 1.02, 104.50, 1.47], port: [103.60, 1.13, 104.12, 1.36], west: [103.28, 1.05, 103.80, 1.32], east: [103.95, 1.10, 104.50, 1.40], ejs: [103.78, 1.25, 104.15, 1.48] };
    Object.keys(VIEWS).forEach(function (k) { $("sg-v-" + k).addEventListener("click", function () { if (map) map.fitBox(VIEWS[k], 1.02); }); });
    $("sg-zin").addEventListener("click", function () { if (map) map.zoomIn(); }); $("sg-zout").addEventListener("click", function () { if (map) map.zoomOut(); });
    $("sg-print").addEventListener("click", function () { window.print(); });
    function makeMap() {
      if (map) return;
      map = SeaMap($("sg-canvas"), $("sg-wrap"), { land: D.land, decode: dec, bounds: D.bounds, home: VIEWS.all, view: isObj(st.view) && isFinite(st.view.s) ? st.view : null,
        tokens: ["true", "accent", "area-eca", "rose", "pos-mark", "map-tss", "ship"], under: under, layers: layers, onPick: pick, onHover: hover, onView: function (v) { st.view = v; save(); } });
      map.resize();
      if (st.pos) { var g = Geo.parse(st.pos); if (!g.error && onChart(g.lon, g.lat)) { mark = [g.lon, g.lat]; info(g.lon, g.lat); } else st.pos = ""; }
      map.draw();
    }
    window.addEventListener("beforeprint", function () {                /* the chart on the print sheet, drawn in day colours */
      if (!map || $("singapore").hidden) return;
      var th = document.documentElement.getAttribute("data-theme");
      if (th && th !== "day") { document.documentElement.setAttribute("data-theme", "day"); map.recolor(); }
      var v = st.view ? { cx: st.view.cx, cy: st.view.cy, s: st.view.s } : null;
      map.fitBox(VIEWS.all, 1.02); $("sg-ps-img").src = map.toDataURL(); map.fitBox(VIEWS.port, 1.02); $("sg-ps-img2").src = map.toDataURL();
      if (v) map.setView(v); else map.draw();
      if (th && th !== "day") { document.documentElement.setAttribute("data-theme", th); map.recolor(); }
    });
    writeMsg();
    makeMap();                                                     /* the page is visible when its init runs, so the canvas has its size */
  }
