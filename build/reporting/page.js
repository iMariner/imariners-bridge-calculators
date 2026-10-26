  /* SREPPAGE-BEGIN: Tool: Ship Reporting Systems (data SR_SYSTEMS from build/reporting/build.py, maths SRoute, chart SeaMap) */
  var SR_LINES = {                                                 /* IMO Res. A.851(20) standard reporting format: what each letter means */
    A: "Ship: name, call sign, IMO number, MMSI, flag", B: "Date and time (UTC) of the report", C: "Position: latitude and longitude", D: "Position: bearing and distance from a landmark",
    E: "True course", F: "Speed in knots", G: "Port of departure", H: "Date, time (UTC) and point of entry into the area", I: "Destination and expected time of arrival",
    J: "Pilot on board", K: "Date, time (UTC) and point of exit from the area", L: "Route information", M: "Radio: stations and channels watched", N: "Time of next report",
    O: "Present maximum draught", P: "Cargo on board: type, quantity, IMO class", Q: "Defects, damage, deficiencies", R: "Pollution or cargo lost overboard", S: "Weather conditions",
    T: "Ship's agent or owner", U: "Ship size and type", V: "Medical personnel on board", W: "Total persons on board", X: "Miscellaneous", Y: "Request to relay the report", Z: "End of report"
  };
  var SR_EXAMPLE = { name: "Ulsan to Kozmino (example only, not a passage plan)", speed: "12.0", last: "Ulsan, Korea", dest: "Kozmino, Russia",
    route: "Ulsan pilot 35 24.0N 129 27.0E\nWP1 35 35.0N 129 40.0E\nWP2 42 20.0N 133 15.0E\nKozmino 42 43.5N 133 05.0E" };
  function initShipReporting() {
    var UI_KEY = "bridgeCalc.srepUi", RAD = Math.PI / 180, HOUR = 3600000;
    var KIND = { "mandatory-imo": ["imo", "Mandatory, IMO-adopted"], "mandatory-national": ["nat", "Mandatory, national"], "voluntary": ["vol", "Voluntary"] };
    var EVENT_NAMES = { before_entry: "before entering", entry: "on entering", exit: "on leaving", departure: "on departure", before_arrival: "before arrival", arrival: "on arrival", position: "position report", deviation: "on a deviation", final: "final report", other: "other" };
    function dec4(arr) { var out = new Array(arr.length), x = 0, y = 0; for (var i = 0; i < arr.length; i += 2) { x += arr[i]; y += arr[i + 1]; out[i] = x / 10000; out[i + 1] = y / 10000; } return out; }
    var SYS = SR_SYSTEMS.map(function (s) {
      var a = s.ar || {}, rings = (s.rg || []).map(dec4);
      if (a.sh === "circle" && a.c && a.r > 0) rings = [SRoute.circle(a.c.la, a.c.lo, a.r)];
      s.G = rings.length ? SRoute.prep(rings) : null; s.rings = rings;
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      function add(lo, la) { if (lo < x0) x0 = lo; if (lo > x1) x1 = lo; if (la < y0) y0 = la; if (la > y1) y1 = la; }
      rings.forEach(function (r) { for (var i = 0; i < r.length; i += 2) add(r[i], r[i + 1]); });
      (a.pts || []).forEach(function (p) { add(p.lo, p.la); });
      s.box = a.bbox || (x1 >= x0 ? [x0, y0, x1, y1] : null);
      s.kc = (KIND[s.k] || ["vol"])[0];
      s.pmap = {}; (a.pts || []).forEach(function (p) { s.pmap[p.n] = p; });
      s.hay = [s.sys, s.t, s.cty, s.au, s.grp, (a.ports || []).join(" ")].join(" ").toLowerCase();
      return s;
    });
    var byId = {}; SYS.forEach(function (s) { byId[s.id] = s; });
    var ui = store.get(UI_KEY) || {}; if (ui.filter !== "all") ui.filter = "route";
    var d = {}, plan = null, wps = [], rows = [], onRoute = {}, cross = {}, selRow = null, map = null;
    function shipKey() { var s = Ships.active(); return "bridgeCalc.srep." + (s ? s.id : "none"); }
    function saveUi() { store.set(UI_KEY, { filter: ui.filter, q: ui.q || "", sel: ui.sel || null, view: ui.view || null }); }
    function saveShip() { store.set(shipKey(), d); }
    function loadShip() {
      d = store.get(shipKey()) || {}; d.voy = d.voy || {}; d.notes = d.notes || {}; d.msg = d.msg || {};
      $("sr-route").value = d.route || ""; $("sr-date").value = d.date || ""; $("sr-time").value = d.time || ""; $("sr-speed").value = d.speed || "";
      ["last", "dest", "dfwd", "daft", "cargo", "pob", "agent", "radio"].forEach(function (k) { $("sr-v-" + k).value = d.voy[k] || ""; });
      var s = Ships.active(); if (!$("sr-v-pob").value && s && s.pob) $("sr-v-pob").placeholder = s.pob;
    }
    function shipLine() {
      var box = $("sr-ship-line"), s = Ships.active(); while (box.firstChild) box.removeChild(box.firstChild);
      if (s) {
        var b = document.createElement("strong"); b.textContent = s.name; box.appendChild(b);
        var miss = [["callsign", "call sign"], ["mmsi", "MMSI"], ["flag", "flag"], ["shipType", "type"]].filter(function (k) { return !s[k[0]]; }).map(function (k) { return k[1]; });
        box.appendChild(document.createTextNode([s.callsign, s.imo ? "IMO " + s.imo : "", s.flag].filter(Boolean).join("  ·  ") + (miss.length ? "  (add " + miss.join(", ") + " for line A)" : "") + "  "));
      } else box.appendChild(document.createTextNode("No ship selected: line A and U fill in from Ship Particulars.  "));
      var a = document.createElement("a"); a.href = "#ship"; a.textContent = s ? "Change" : "Add ship"; box.appendChild(a);
    }

    /* ---------- the passage ---------- */
    function readRoute() {
      var lines = $("sr-route").value.split(/\r?\n/), bad = [];
      wps = [];
      lines.forEach(function (l, i) { if (!l.trim()) return; var r = Geo.parse(l); if (r.error) bad.push("Line " + (i + 1) + ": " + r.error); else wps.push({ lat: r.lat, lon: r.lon, name: r.name }); });
      var date = parseDateEl($("sr-date")), t = parseTimeEl($("sr-time")), sp = parseNum($("sr-speed"));
      var startMs = date && t !== null ? Date.UTC(date.y, date.m - 1, date.d) + t * 1000 : null, speed = sp !== null && !isNaN(sp) && sp > 0 && sp <= 40 ? sp : null;
      $("sr-speed").setAttribute("aria-invalid", sp !== null && speed === null ? "true" : "false");
      plan = wps.length ? SRoute.plan(wps, startMs, speed) : null;
      var msg = $("sr-route-msg");
      if (bad.length) { msg.textContent = bad.slice(0, 3).join("  ·  "); msg.className = "hint error"; }
      else if (plan && plan.legs.length) { msg.textContent = wps.length + " positions, " + fmtNM(plan.total) + (speed ? ", " + span(plan.total / speed) + " at " + speed + " kn" : ""); msg.className = "hint"; }
      else { msg.textContent = "Any format: 3525.0N 12925.0E, 35 25.0 N 129 25.0 E, 35-25.0N. A name in front is kept."; msg.className = "hint"; }
    }
    function fmtNM(x) { return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10) + " NM"; }
    function span(h) { var m = Math.round(h * 60), dd = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60); return (dd ? dd + " d " : "") + hh + " h" + (dd ? "" : " " + TIME.p2(m % 60) + " m"); }
    function dtg(ms) { var x = new Date(Math.round(ms / 60000) * 60000); return TIME.p2(x.getUTCDate()) + TIME.p2(x.getUTCHours()) + TIME.p2(x.getUTCMinutes()) + "Z"; }
    function whenTxt(ms) { var x = new Date(Math.round(ms / 60000) * 60000); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x.getUTCDay()] + " " + TIME.p2(x.getUTCDate()) + " " + TIME.MONTHS[x.getUTCMonth()] + "  " + TIME.p2(x.getUTCHours()) + ":" + TIME.p2(x.getUTCMinutes()) + " UTC"; }
    function pos4(lat, lon) {                                       /* A.851 groups: 4 digits of latitude, 5 of longitude, whole minutes */
      function g(v, w, p, n) { var a = Math.abs(v), m = Math.round(a * 60), dg = Math.floor(m / 60); return ("00" + dg).slice(-w) + TIME.p2(m % 60) + (v < 0 ? n : p); }
      return g(lat, 2, "N", "S") + " " + g(lon, 3, "E", "W");
    }
    function posTxt(lat, lon) { return Geo.lat(lat) + " " + Geo.lon(lon); }
    function tAt(dNM) { return plan ? SRoute.timeAt(plan, dNM) : null; }

    /* which systems the route meets, and every report that falls due */
    var NOT_NAMES = /^(port|ports|seaport|seaports|bay|bays|gulf|all|every|other|others|section|the|of|and|for|ships|coming|from|foreign|including|incl|terminal|terminals|oil|harbour|area|sea|new|outer|inner|north|south|east|west)$/;
    function words(t) { return String(t || "").toLowerCase().replace(/[^a-z\u00c0-\u024f\u0400-\u04ff]+/g, " ").split(" ").filter(function (w) { return w.length >= 4 && !NOT_NAMES.test(w); }); }
    function portHit(s) {                                          /* the route ends at one of the system's ports: by name (last position or destination) or inside a small port box */
      var a = s.ar || {}, ports = a.ports || []; if (!plan || !wps.length) return false;
      var last = wps[wps.length - 1], b = a.bbox;
      if (b && b[2] - b[0] < 3 && b[3] - b[1] < 3 && last.lat >= b[1] - 0.1 && last.lat <= b[3] + 0.1 && SRoute.n180(last.lon - b[0]) >= -0.1 && SRoute.n180(last.lon - b[2]) <= 0.1) return true;
      var hay = words((last.name || "") + " " + (d.voy.dest || ""));
      return ports.some(function (p) { return words(p).some(function (w) { return hay.some(function (h) { return w.indexOf(h) === 0 || h.indexOf(w) === 0; }); }); });
    }
    function compute() {
      rows = []; onRoute = {}; cross = {};
      if (!plan || !plan.pts.length) return;
      var endD = plan.total, endMs = tAt(endD);
      SYS.forEach(function (s) {
        var c = null, entries = [], exits = [], endIn = false, startIn = false;
        if (s.G) {
          c = SRoute.cross(plan, s.G); startIn = c.startInside;
          endIn = c.endInside; c.events.forEach(function (e) { (e.kind === "entry" ? entries : exits).push(e); });
        }
        if (s.ar && s.ar.sh === "port" && portHit(s)) { endIn = true; }
        if (!startIn && !endIn && !entries.length) return;
        cross[s.id] = { c: c, startIn: startIn, endIn: endIn, entries: entries, exits: exits }; onRoute[s.id] = true;
        var when = s.when && s.when.length ? s.when : [{ e: "entry", x: "Report on entering the area." }];
        function row(w, ev, ms, label) { rows.push({ s: s, w: w, ev: ev, due: ms, label: label }); }
        var startEv = { kind: "start", d: 0, lat: plan.pts[0].lat, lon: plan.pts[0].lon, x: plan.pts[0].x }, last = plan.pts[plan.pts.length - 1], endEv = { kind: "end", d: endD, lat: last.lat, lon: last.lon, x: last.x };
        when.forEach(function (w) {
          var h = isFinite(w.h) && w.h > 0 ? w.h : 0;
          if (w.e === "before_entry" || w.e === "entry") {
            entries.forEach(function (e) { var t = tAt(e.d); row(w, e, t === null ? null : t - (w.e === "before_entry" ? h * HOUR : 0), w.e === "before_entry" ? h + " h before entering" : "On entering"); });
            if (startIn) row(w, startEv, plan.startMs, "Before departure (you start inside)");
          } else if (w.e === "exit" || w.e === "final") {
            exits.forEach(function (e) { row(w, e, tAt(e.d), w.e === "final" ? "Final report, on leaving" : "On leaving"); });
            if (w.e === "final" && endIn) row(w, endEv, endMs, "Final report, on arrival");
          } else if (w.e === "departure") { if (startIn) row(w, startEv, plan.startMs, "On departure"); }
          else if (w.e === "before_arrival" || w.e === "arrival") { if (endIn) row(w, endEv, endMs === null ? null : endMs - (w.e === "before_arrival" ? h * HOUR : 0), w.e === "before_arrival" ? h + " h before arrival" : "On arrival"); }
          else if (w.e === "position" && isFinite(w.iv) && w.iv > 0 && plan.speed) {
            var segs = [], open = startIn ? 0 : null;
            if (c) c.events.forEach(function (e) { if (e.kind === "entry") open = e.d; else if (open !== null) { segs.push([open, e.d]); open = null; } });
            if (open !== null) segs.push([open, endD]);
            segs.forEach(function (sg) { for (var k = 1, dd = sg[0] + w.iv * plan.speed; dd < sg[1] && k <= 12; k++, dd += w.iv * plan.speed) { var q = SRoute.atDist(plan, dd); row(w, { kind: "pos", d: dd, lat: q.lat, lon: q.lon, x: q.x }, tAt(dd), "Position report (every " + w.iv + " h)"); } });
          }
        });
      });
      rows.sort(function (a, b) { var x = a.due === null ? 1e18 : a.due, y = b.due === null ? 1e18 : b.due; return x - y || a.ev.d - b.ev.d; });
    }

    /* ---------- the list of systems ---------- */
    function renderList() {
      var box = $("sr-list"), q = ($("sr-search").value || "").toLowerCase().trim(), grp = null, shown = 0;
      while (box.firstChild) box.removeChild(box.firstChild);
      var useRoute = ui.filter === "route" && plan && plan.legs.length;
      SYS.forEach(function (s) {
        if (q && s.hay.indexOf(q) < 0) return;
        if (useRoute && !onRoute[s.id] && !q) return;
        if (s.grp !== grp) { grp = s.grp; var h = document.createElement("div"); h.className = "sr-grp"; h.textContent = grp; box.appendChild(h); }
        var b = document.createElement("button"); b.type = "button"; b.className = "sr-item" + (s.id === ui.sel ? " sel" : "");
        var sw = document.createElement("i"); sw.className = "sr-sw k-" + s.kc; b.appendChild(sw);
        var mid = document.createElement("span"), t = document.createElement("b"); t.textContent = s.t; mid.appendChild(t);
        var m = document.createElement("span"); m.className = "m"; m.textContent = [s.sys !== s.t ? s.sys : "", (KIND[s.k] || [0, ""])[1], s.cty].filter(Boolean).join("  ·  "); mid.appendChild(m); b.appendChild(mid);
        var on = document.createElement("span"); on.className = "sr-on"; on.textContent = onRoute[s.id] ? "On route" : ""; b.appendChild(on);
        b.addEventListener("click", function () { select(s.id, true); });
        box.appendChild(b); shown++;
      });
      if (!shown) { var p = document.createElement("p"); p.className = "small muted"; p.textContent = useRoute ? "Your route meets none of the systems in this file. Press All to see every system." : "No system matches."; box.appendChild(p); }
    }

    /* ---------- reports on this passage ---------- */
    function contactTxt(s) {
      var e = (s.how || []).filter(function (h) { return h.ty === "email"; })[0], v = (s.how || []).filter(function (h) { return h.ty === "vhf"; })[0];
      var vt = v ? "VHF " + String(v.v).replace(/^(VHF\s*)/i, "") + (v.to ? " " + v.to : "") : "";
      return [e ? e.v : "", vt.length > 48 ? vt.slice(0, 46).replace(/\s+\S*$/, "") + " …" : vt].filter(Boolean);
    }
    function renderPlan() {
      var t = $("sr-plan"); while (t.firstChild) t.removeChild(t.firstChild);
      var warn = [];
      if (!plan || !plan.legs.length) warn.push("Enter at least two positions to check the route.");
      else if (plan.speed === null || plan.startMs === null) warn.push("Enter the departure date, time (UTC) and speed to see when each report is due.");
      $("sr-plan-warn").hidden = !warn.length; $("sr-plan-warn").textContent = warn.join(" ");
      var th = document.createElement("thead"), tr = document.createElement("tr");
      ["#", "Send", "System and report", "Where", "To"].forEach(function (x) { var c = document.createElement("th"); c.textContent = x; tr.appendChild(c); });
      th.appendChild(tr); t.appendChild(th);
      var tb = document.createElement("tbody"), now = Date.now();
      if (!rows.length) {
        var r0 = document.createElement("tr"), c0 = document.createElement("td"); c0.colSpan = 5; c0.className = "empty";
        c0.textContent = plan && plan.legs.length ? "No reporting system in this file is met on this route. Always check your ALRS: national and port reporting is not all here yet." : "The reports will be listed here.";
        r0.appendChild(c0); tb.appendChild(r0);
      }
      rows.forEach(function (r, i) {
        var tr2 = document.createElement("tr"); if (r.due !== null && r.due < now) tr2.className = "past"; if (selRow === r) tr2.className += " sel";
        function cell(cls, big, small) { var c = document.createElement("td"); c.className = cls; if (big !== null) { var b = document.createElement(cls === "no" ? "span" : "b"); b.textContent = big; c.appendChild(b); } (small || []).forEach(function (s) { if (!s) return; var sp = document.createElement("span"); sp.textContent = s; c.appendChild(sp); }); tr2.appendChild(c); return c; }
        cell("no", String(i + 1));
        cell("due", r.due === null ? "time?" : whenTxt(r.due).replace(" UTC", ""), [r.due === null ? "needs departure time and speed" : "UTC  ·  " + dtg(r.due)]);
        cell("sys", r.s.t, [r.label + (r.w.rep ? " (" + r.w.rep + ")" : "") + (r.due !== null && plan && plan.startMs !== null && r.due < plan.startMs - 60000 ? ": due before you sail" : "")]);
        cell("at", posTxt(r.ev.lat, r.ev.lon), [r.ev.kind === "entry" ? "boundary, entering" : r.ev.kind === "exit" ? "boundary, leaving" : r.ev.kind === "start" ? "departure" : r.ev.kind === "end" ? "arrival" : "on the route"]);
        var ct = contactTxt(r.s); cell("to", ct[0] || "see the system card", ct.slice(1));
        tr2.addEventListener("click", function () { selRow = r; select(r.s.id, false, r); });
        tb.appendChild(tr2);
      });
      t.appendChild(tb);
      $("sr-plan-sub").textContent = rows.length ? rows.length + " report" + (rows.length > 1 ? "s" : "") + " on this passage, in the order they fall due. Click one to build the message." : "Enter the route, departure time and speed: every report falls due in order, with the time to send it.";
    }

    /* ---------- the chart ---------- */
    function colorOf(api, s) { return s.kc === "imo" ? api.C["area-special"] : s.kc === "nat" ? api.C["area-eca"] : api.C.rose; }
    var night = function () { return document.documentElement.getAttribute("data-theme") === "night"; };
    function under(api, offs) {
      var ctx = api.ctx();
      SYS.forEach(function (s) {
        if (!s.rings.length || !s.box) return;
        var sel = s.id === ui.sel, dim = ui.filter === "route" && plan && plan.legs.length && !onRoute[s.id] && !sel;
        ctx.fillStyle = api.alpha(colorOf(api, s), (sel ? 0.34 : dim ? 0.06 : 0.16) * (night() ? 0.6 : 1));
        offs.forEach(function (off) { if (!api.seen(s.box, off)) return; ctx.beginPath(); s.rings.forEach(function (r) { api.ring(r, off); }); ctx.fill(); });
      });
    }
    function layers(api, offs) {
      var ctx = api.ctx(), X = api.X, Y = api.Y;
      SYS.forEach(function (s) {
        if (!s.box) return;
        var sel = s.id === ui.sel, dim = ui.filter === "route" && plan && plan.legs.length && !onRoute[s.id] && !sel, a = s.ar || {};
        ctx.strokeStyle = colorOf(api, s); ctx.globalAlpha = dim ? 0.35 : 1; ctx.lineWidth = sel ? 2.6 : 1.4;
        offs.forEach(function (off) {
          if (!api.seen(s.box, off)) return;
          if (a.sh === "lines" && a.lines && a.lines.length) {          /* official boundary lines; the coast closes the rest */
            ctx.setLineDash([]); ctx.beginPath();
            a.lines.forEach(function (seq) { seq.forEach(function (n, i) { var p = s.pmap[n]; if (!p) return; var x = X(p.lo + off), y = Y(p.la); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); });
            ctx.stroke();
          } else if (s.rings.length) {
            ctx.setLineDash(s.rgs === "official" ? [] : [6, 4]); ctx.beginPath(); s.rings.forEach(function (r) { api.ring(r, off); }); ctx.stroke();
          }
          if (a.sh === "port" && a.pts) a.pts.forEach(function (p) { var x = X(p.lo + off), y = Y(p.la); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(x, y, sel ? 7 : 5, 0, 7); ctx.stroke(); });
        });
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        if (sel && a.pts && api.scale() > 30) {
          ctx.font = "bold 11px " + api.C.font; ctx.textBaseline = "middle"; ctx.textAlign = "left";
          offs.forEach(function (off) { a.pts.forEach(function (p) { var x = X(p.lo + off), y = Y(p.la); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = p.inf ? api.C.sea : api.C.ink; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = api.C.ink; ctx.stroke(); if (a.pts.length < 60 || api.scale() > 120) { ctx.fillStyle = api.C.ink; ctx.fillText(p.n, x + 6, y - 6); } }); });
        }
      });
      if (!plan || !plan.pts.length) return;
      var red = api.C["pos-mark"];
      ctx.strokeStyle = red; ctx.lineWidth = 2.4;
      offs.forEach(function (off) { ctx.beginPath(); plan.pts.forEach(function (p, i) { var x = X(p.x + off), y = Y(p.lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); });
      ctx.font = "bold 11px " + api.C.font; ctx.textBaseline = "middle";
      offs.forEach(function (off) {
        plan.pts.forEach(function (p, i) { var x = X(p.x + off), y = Y(p.lat); ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = api.C.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = red; ctx.stroke(); if (p.name && (i === 0 || i === plan.pts.length - 1 || api.scale() > 25)) { ctx.fillStyle = api.C.ink; ctx.textAlign = "left"; ctx.fillText(p.name, x + 8, y); } });
        rows.forEach(function (r, i) {
          if (r.ev.kind === "end" || r.ev.kind === "start") return;
          var x = X((isFinite(r.ev.x) ? r.ev.x : r.ev.lon) + off), y = Y(r.ev.lat);
          ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = selRow === r ? api.C.ink : red; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = api.C.paper; ctx.stroke();
          ctx.fillStyle = api.C.paper; ctx.textAlign = "center"; ctx.fillText(String(i + 1), x, y + 0.5);
        });
      });
      ctx.textAlign = "left";
    }
    function systemsAt(lat, lon) { return SYS.filter(function (s) { return s.G && s.box && SRoute.inside(s.G, lat, lon); }); }
    var hoverT = 0;
    function hover(lat, lon) {
      var now = Date.now(); if (now - hoverT < 60) return; hoverT = now;
      var at = systemsAt(lat, lon).map(function (s) { return s.sys; });
      $("sr-cursor").textContent = posTxt(lat, lon) + (at.length ? "   ·  inside: " + at.join(", ") : "");
    }
    function pick(lat, lon) {
      var at = systemsAt(lat, lon); if (!at.length) return;
      at.sort(function (a, b) { return (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) - (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]); });
      var i = 0; for (var k = 0; k < at.length; k++) if (at[k].id === ui.sel) i = (k + 1) % at.length;   /* tap again to step through areas that overlap */
      select(at[i].id, false);
    }
    function routeBox() {
      if (!plan || !plan.pts.length) return null;
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; plan.pts.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.lat); y1 = Math.max(y1, p.lat); });
      var px = Math.max(1, (x1 - x0) * 0.15), py = Math.max(1, (y1 - y0) * 0.15); return [x0 - px, Math.max(-84, y0 - py), x1 + px, Math.min(84, y1 + py)];
    }

    /* ---------- one system ---------- */
    function fact(box, title, nodes, wide) {
      var f = document.createElement("div"); f.className = "sr-fact" + (wide ? " wide" : ""); var h = document.createElement("h3"); h.textContent = title; f.appendChild(h);
      nodes.forEach(function (n) { if (n) f.appendChild(n); }); box.appendChild(f);
    }
    function para(t, cls) { if (!t) return null; var p = document.createElement("p"); if (cls) p.className = cls; p.textContent = t; return p; }
    function list(items) { if (!items.length) return null; var u = document.createElement("ul"); items.forEach(function (x) { var li = document.createElement("li"); if (typeof x === "string") li.textContent = x; else li.appendChild(x); u.appendChild(li); }); return u; }
    function renderSys() {
      var s = byId[ui.sel]; $("sr-sys").hidden = !s; $("sr-msg").hidden = !s; if (!s) return;
      $("sr-d-sys").textContent = s.sys; $("sr-d-title").textContent = s.t;
      var tags = $("sr-d-tags"); while (tags.firstChild) tags.removeChild(tags.firstChild);
      [[(KIND[s.k] || [0, s.k])[1], "k-" + s.kc], [s.cty], [s.res], [s.st && s.st !== "in effect" ? s.st : ""], ["Checked " + s.chk], [s.cf === "low" ? "Low confidence: check before use" : s.cf === "medium" ? "Medium confidence" : "", s.cf === "low" ? "low" : ""]].forEach(function (t) { if (!t[0]) return; var sp = document.createElement("span"); sp.className = "sr-tag" + (t[1] ? " " + t[1] : ""); sp.textContent = t[0]; tags.appendChild(sp); });
      var F = $("sr-facts"); while (F.firstChild) F.removeChild(F.firstChild);
      fact(F, "Who must report", [para(s.ap), para(s.apq ? "“" + s.apq + "”" : "", "q")]);
      fact(F, "When", [list((s.when || []).map(function (w) { return (EVENT_NAMES[w.e] ? EVENT_NAMES[w.e].charAt(0).toUpperCase() + EVENT_NAMES[w.e].slice(1) + (w.h ? " (" + w.h + " h)" : "") + (w.iv ? " (every " + w.iv + " h)" : "") + (w.rep ? ", " + w.rep : "") + ": " : "") + (w.x || ""); }))]);
      fact(F, "How to send", [list((s.how || []).map(function (h) { var sp = document.createElement("span"); var c = document.createElement("span"); c.className = "c"; c.textContent = (h.ty === "email" ? "" : h.ty.toUpperCase().replace("INMARSAT-C", "Inmarsat C") + " ") + h.v; sp.appendChild(c); sp.appendChild(document.createTextNode((h.to ? "  " + h.to : "") + (h.n ? " (" + h.n + ")" : ""))); return sp; }))]);
      fact(F, "Address and heading", [para(s.ad ? "To: " + s.ad : ""), para(s.hd ? "Heading: " + s.hd : ""), para(!s.ad && !s.hd ? "No special address line or heading is given by the source." : "", "q"), para(s.fn, "q")]);
      if (s.nt) fact(F, "Notes", [para(s.nt)], true);
      var ab = $("sr-d-areabody"); while (ab.firstChild) ab.removeChild(ab.firstChild);
      var a = s.ar || {};
      function addP(n) { if (n) ab.appendChild(n); }
      addP(para(a.sh === "lat_limit" ? "A large ocean area; the chart shows its limits as a box." : a.sh === "territorial-sea" ? "The area is the territorial sea (12 NM)" + (a.zone ? " of " + a.zone : "") + ". The chart draws it from the Marine Regions data set: derived, not official." :
        a.sh === "circle" ? "A circle of " + a.r + " NM radius around " + posTxt(a.c.la, a.c.lo) + "." : a.sh === "port" ? "Reports tied to arrival at: " + (a.ports || []).join(", ") + "." :
        a.sh === "lines" ? "Bounded by the official lines below and the coast." : a.sh === "polygon" ? "The polygon joining the points below." : a.sh === "eez" ? "The exclusive economic zone (200 NM) of " + (a.state || "the state") + ", drawn from Marine Regions: derived, not official." : ""));
      if (s.aq) addP(para("“" + s.aq + "”", "q"));
      if (a.pts && a.pts.length) {
        var tb = document.createElement("table"); tb.className = "dt sa-ptbl"; var hr = document.createElement("tr");
        ["Point", "Latitude", "Longitude", "Name"].forEach(function (x, i) { var c = document.createElement("th"); c.textContent = x; if (i === 1 || i === 2) c.className = "num"; hr.appendChild(c); }); tb.appendChild(hr);
        a.pts.forEach(function (p) { var r = document.createElement("tr"); [p.n, Geo.lat(p.la), Geo.lon(p.lo), (p.nm || "") + (p.inf ? " (not printed in the source)" : "")].forEach(function (x, i) { var c = document.createElement("td"); c.textContent = x; if (i === 1 || i === 2) c.className = "num"; r.appendChild(c); }); tb.appendChild(r); });
        ab.appendChild(tb);
      }
      $("sr-d-area").hidden = !(a.pts && a.pts.length) && !s.aq && !a.sh;
      $("sr-notes").value = d.notes[s.id] || "";
      var src = $("sr-d-src"); while (src.firstChild) src.removeChild(src.firstChild);
      src.appendChild(document.createTextNode("Source: "));
      (s.src || []).forEach(function (x, i) { if (i) src.appendChild(document.createTextNode("; ")); var e = document.createElement(x.url ? "a" : "span"); if (x.url) { e.href = x.url; e.target = "_blank"; e.rel = "noopener"; } e.textContent = x.t + (x.ref ? ", " + x.ref : "") + (x.date ? " (" + x.date + ")" : ""); src.appendChild(e); });
      if (s.ver) src.appendChild(document.createTextNode(". How it was checked: " + s.ver));
      renderMsg();
    }

    /* ---------- the message ---------- */
    function sysRows(s) { return rows.filter(function (r) { return r.s === s; }); }
    function eventOptions(s) {
      var sel = $("sr-m-event"), cur = (d.msg[s.id] || {}).ev, opts = sysRows(s);
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      opts.forEach(function (r, i) { var o = document.createElement("option"); o.value = "r" + i; o.textContent = r.label + (r.due !== null ? ", due " + whenTxt(r.due) : ""); sel.appendChild(o); });
      var o2 = document.createElement("option"); o2.value = "manual"; o2.textContent = opts.length ? "Other time (type it below)" : "Report (this system is not on your route: type the time)"; sel.appendChild(o2);
      if (selRow && selRow.s === s) sel.value = "r" + opts.indexOf(selRow); else if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur; else sel.value = opts.length ? "r0" : "manual";
      return opts;
    }
    function localDT(ms) { var x = new Date(Math.round(ms / 60000) * 60000); return x.getUTCFullYear() + "-" + TIME.p2(x.getUTCMonth() + 1) + "-" + TIME.p2(x.getUTCDate()) + "T" + TIME.p2(x.getUTCHours()) + ":" + TIME.p2(x.getUTCMinutes()); }
    function readDT(v) { var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; }
    function context(s) {
      var opts = sysRows(s), v = $("sr-m-event").value, r = v.charAt(0) === "r" ? opts[+v.slice(1)] : null;
      var bMs = readDT($("sr-m-time").value); if (bMs === null && r && r.due !== null) bMs = r.due;
      var cr = cross[s.id], entry = null, exit = null;
      if (cr) {
        var ref = r ? r.ev.d : (plan && bMs !== null && plan.speed ? (bMs - plan.startMs) / HOUR * plan.speed : 0);
        entry = cr.entries.filter(function (e) { return e.d <= ref + 1e-6 || (r && r.ev.kind === "entry"); }).pop() || cr.entries[0] || null;
        if (r && r.ev.kind === "entry") entry = r.ev; else if (r && r.ev.kind === "start") entry = { d: 0, lat: plan.pts[0].lat, lon: plan.pts[0].lon, start: true };
        var after = entry ? entry.d : ref; exit = cr.exits.filter(function (e) { return e.d >= after - 1e-6; })[0] || null;
      }
      return { r: r, bMs: bMs, entry: entry, exit: exit };
    }
    function auto(L, s, x) {
      var ship = Ships.active() || {}, V = d.voy, P = plan && plan.speed && x.bMs !== null ? SRoute.at(plan, x.bMs) : null;
      function num(v, u) { var n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) ? n.toFixed(2) + (u || "") : ""; }
      switch (L) {
        case "A": return [ship.name, ship.callsign, ship.imo, ship.mmsi, ship.flag].filter(Boolean).join(" / ").toUpperCase();
        case "B": return x.bMs !== null ? dtg(x.bMs) : "";
        case "C": return P ? pos4(P.lat, P.lon) : "";
        case "E": return P && P.course !== null ? ("00" + Math.round(P.course) % 360).slice(-3) : "";
        case "F": return plan && plan.speed ? plan.speed.toFixed(1) + " KN" : "";
        case "G": return (V.last || (wps[0] && wps[0].name) || "").toUpperCase();
        case "H": return x.entry && !x.entry.start && tAt(x.entry.d) !== null ? dtg(tAt(x.entry.d)) + " " + pos4(x.entry.lat, x.entry.lon) : "";
        case "I": var dest = (V.dest || (wps.length > 1 && wps[wps.length - 1].name) || "").toUpperCase(), eta = plan && tAt(plan.total); return dest ? dest + (eta ? " / ETA " + dtg(eta) + " " + TIME.MONTHS[new Date(eta).getUTCMonth()].toUpperCase() : "") : "";
        case "K": return x.exit && tAt(x.exit.d) !== null ? dtg(tAt(x.exit.d)) + " " + pos4(x.exit.lat, x.exit.lon) : "";
        case "L": return wps.length > 1 ? "RHUMB LINES VIA " + wps.slice(1, -1).map(function (w) { return pos4(w.lat, w.lon); }).join(", ") : "";
        case "M": return (V.radio || "VHF CH 16").toUpperCase();
        case "O": return V.dfwd || V.daft ? "FWD " + num(V.dfwd, " M") + " / AFT " + num(V.daft, " M") : "";
        case "P": return (V.cargo || "").toUpperCase();
        case "Q": case "R": case "V": case "X": return "NIL";
        case "T": return (V.agent || "").toUpperCase();
        case "U": return [ship.shipType, ship.loa ? "LOA " + Number(ship.loa).toFixed(2) + " M" : "", ship.gt ? "GT " + ship.gt : "", ship.dwt ? "DWT " + ship.dwt : ""].filter(Boolean).join(", ").toUpperCase();
        case "W": return V.pob || ship.pob || "";
        case "Z": return "END OF MESSAGE";
      }
      return "";
    }
    var lineEls = [];
    function renderMsg() {
      var s = byId[ui.sel]; if (!s) return;
      var M = d.msg[s.id] = d.msg[s.id] || {}; M.lines = M.lines || {};
      eventOptions(s);
      var x0 = context(s);
      if (!$("sr-m-time").dataset.typed || $("sr-m-time").dataset.sys !== s.id) { $("sr-m-time").value = x0.r && x0.r.due !== null ? localDT(x0.r.due) : (M.time || ""); $("sr-m-time").dataset.sys = s.id; $("sr-m-time").dataset.typed = ""; }
      var x = context(s), T = $("sr-lines"); while (T.firstChild) T.removeChild(T.firstChild); lineEls = [];
      var L = s.ln && s.ln.length ? s.ln : "ABCEFGHIKMOPQUWX".split("").map(function (l) { return { l: l, s: l, r: "required", x: "" }; });
      L.forEach(function (ln) {
        var tr = document.createElement("tr"); if (ln.r === "optional") tr.className = "opt";
        var c1 = document.createElement("td"); c1.className = "l"; c1.textContent = ln.l; tr.appendChild(c1);
        var c2 = document.createElement("td"); c2.className = "w"; var b = document.createElement("b"); b.textContent = ln.x || SR_LINES[ln.l] || ln.l; c2.appendChild(b);
        if (ln.r === "optional" || ln.r === "if-applicable") c2.appendChild(document.createTextNode(ln.r === "optional" ? " (optional)" : " (if it applies)"));
        tr.appendChild(c2);
        var c3 = document.createElement("td"); c3.className = "v"; var ta = document.createElement("textarea"); ta.rows = 1; ta.setAttribute("aria-label", "Line " + ln.l);
        var typed = M.lines[ln.l]; ta.value = typed !== undefined ? typed : (ln.s || (s.ln && s.ln.length ? "" : ln.l)) ? auto(ln.s || ln.l, s, x) : ""; ta.className = typed !== undefined ? "" : "auto";
        ta.addEventListener("input", function () { M.lines[ln.l] = ta.value; ta.className = ""; saveShip(); out(); });
        c3.appendChild(ta); tr.appendChild(c3); T.appendChild(tr); lineEls.push({ l: ln.l, ta: ta, r: ln.r });
      });
      out();
    }
    function message(s) {
      var body = []; if (s.ad) body.push(s.ad.toUpperCase()); if (s.hd) body.push(s.hd.toUpperCase()); if (body.length) body.push("");
      lineEls.forEach(function (e) { var v = e.ta.value.trim(); if (!v && e.r !== "required") return; body.push(e.l + "  " + (v || "")); });
      return body.join("\n");
    }
    function out() {
      var s = byId[ui.sel]; if (!s) return;
      var send = $("sr-send"); while (send.firstChild) send.removeChild(send.firstChild);
      var emails = (s.how || []).filter(function (h) { return h.ty === "email"; }).map(function (h) { return h.v; }), others = (s.how || []).filter(function (h) { return h.ty !== "email"; }).map(function (h) { return h.ty.replace("inmarsat-c", "Inmarsat C").toUpperCase() + " " + h.v + (h.to ? " (" + h.to + ")" : ""); });
      [["E-mail", emails.join(", ")], ["Subject", s.hd || (s.sys + " REPORT " + (((Ships.active() || {}).name) || "")).toUpperCase()], ["Or by", others.join("  ·  ")], ["Ship's notes", d.notes[s.id] || ""]].forEach(function (p) { if (!p[1]) return; var dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = p[0]; dd.textContent = p[1]; send.appendChild(dt); send.appendChild(dd); });
      var miss = lineEls.filter(function (e) { return e.r === "required" && !e.ta.value.trim(); }).map(function (e) { return e.l; });
      $("sr-out").textContent = message(s) + (miss.length ? "\n\n(Still empty: line " + miss.join(", ") + ")" : "");
    }

    /* ---------- selection and redraw ---------- */
    function select(id, fit, row) {
      if (!byId[id]) return; ui.sel = id; if (row === undefined && (!selRow || selRow.s.id !== id)) selRow = null; saveUi();
      $("sr-m-time").dataset.typed = "";
      renderList(); renderSys(); renderPlan(); if (map) map.draw();
      if (fit && map && byId[id].box) map.fitBox(byId[id].box);
    }
    function refresh() {
      readRoute(); compute(); shipLine(); renderList(); renderPlan(); renderSys(); if (map) map.draw();
    }
    function onPass() {
      d.route = $("sr-route").value; d.date = $("sr-date").value; d.time = $("sr-time").value; d.speed = $("sr-speed").value; saveShip(); refresh();
    }

    ["sr-route", "sr-date", "sr-time", "sr-speed"].forEach(function (id) { $(id).addEventListener("input", onPass); $(id).addEventListener("change", onPass); });
    ["last", "dest", "dfwd", "daft", "cargo", "pob", "agent", "radio"].forEach(function (k) { $("sr-v-" + k).addEventListener("input", function () { d.voy[k] = this.value; saveShip(); if (k === "dest") { compute(); renderList(); renderPlan(); if (map) map.draw(); } renderMsg(); }); });
    $("sr-notes").addEventListener("input", function () { if (!ui.sel) return; d.notes[ui.sel] = this.value; saveShip(); out(); });
    $("sr-m-event").addEventListener("change", function () { var s = byId[ui.sel]; if (!s) return; (d.msg[s.id] = d.msg[s.id] || {}).ev = this.value; selRow = null; var o = sysRows(s); if (this.value.charAt(0) === "r") selRow = o[+this.value.slice(1)] || null; saveShip(); $("sr-m-time").dataset.typed = ""; renderMsg(); renderPlan(); if (map) map.draw(); });
    $("sr-m-time").addEventListener("change", function () { var s = byId[ui.sel]; if (!s) return; this.dataset.typed = "1"; (d.msg[s.id] = d.msg[s.id] || {}).time = this.value; saveShip(); renderMsg(); });
    $("sr-copy").addEventListener("click", function () { var s = byId[ui.sel]; if (s) copyText(message(s)); });
    $("sr-mail").addEventListener("click", function () {
      var s = byId[ui.sel]; if (!s) return;
      var to = (s.how || []).filter(function (h) { return h.ty === "email"; }).map(function (h) { return h.v; }).join(",");
      if (!to) { toast("No e-mail address is given for this system: use the other means shown"); return; }
      var subj = s.hd || (s.sys + " REPORT " + (((Ships.active() || {}).name) || "")).toUpperCase();
      location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(message(s));
    });
    $("sr-reset").addEventListener("click", function () { var s = byId[ui.sel]; if (!s) return; if (d.msg[s.id]) d.msg[s.id].lines = {}; saveShip(); renderMsg(); toast("Lines worked out again from the route and the ship"); });
    $("sr-search").addEventListener("input", function () { ui.q = this.value; saveUi(); renderList(); });
    [].forEach.call(document.querySelectorAll('input[name="sr-filter"]'), function (r) { r.checked = r.value === ui.filter; r.addEventListener("change", function () { ui.filter = this.value; saveUi(); renderList(); if (map) map.draw(); }); });
    $("sr-now").addEventListener("click", function () { var n = new Date(); $("sr-date").value = n.getUTCFullYear() + "-" + TIME.p2(n.getUTCMonth() + 1) + "-" + TIME.p2(n.getUTCDate()); $("sr-time").value = TIME.p2(n.getUTCHours()) + ":" + TIME.p2(n.getUTCMinutes()); onPass(); });
    $("sr-example").addEventListener("click", function () {
      var n = new Date(Date.now() + 24 * HOUR);
      $("sr-route").value = SR_EXAMPLE.route; $("sr-speed").value = SR_EXAMPLE.speed;
      $("sr-date").value = n.getUTCFullYear() + "-" + TIME.p2(n.getUTCMonth() + 1) + "-" + TIME.p2(n.getUTCDate()); $("sr-time").value = "06:00";
      if (!d.voy.last) { d.voy.last = SR_EXAMPLE.last; $("sr-v-last").value = SR_EXAMPLE.last; } if (!d.voy.dest) { d.voy.dest = SR_EXAMPLE.dest; $("sr-v-dest").value = SR_EXAMPLE.dest; }
      onPass(); var b = routeBox(); if (b && map) map.fitBox(b);
      if (rows.length) { selRow = rows[0]; select(rows[0].s.id, false, rows[0]); }
      toast("Example route loaded: " + SR_EXAMPLE.name);
    });
    $("sr-clear").addEventListener("click", function () { $("sr-route").value = ""; onPass(); });
    $("sr-zin").addEventListener("click", function () { map.zoomIn(); });
    $("sr-zout").addEventListener("click", function () { map.zoomOut(); });
    $("sr-world").addEventListener("click", function () { map.world(); });
    $("sr-fitroute").addEventListener("click", function () { var b = routeBox(); if (b) map.fitBox(b); else toast("Enter the route first"); });
    $("sr-fitsys").addEventListener("click", function () { var s = byId[ui.sel]; if (s && s.box) map.fitBox(s.box); else toast("Choose a system first"); });
    $("sr-d-zoom").addEventListener("click", function () { var s = byId[ui.sel]; if (s && s.box) { map.fitBox(s.box); $("sr-wrap").scrollIntoView({ block: "center" }); } });
    Ships.onChange(function () { loadShip(); refresh(); });

    loadShip(); readRoute(); compute();
    map = SeaMap($("sr-canvas"), $("sr-wrap"), { view: ui.view, tokens: ["area-special", "area-eca", "rose", "pos-mark"], under: under, layers: layers, onPick: pick, onHover: hover, onView: function (v) { ui.view = v; saveUi(); } });
    refresh(); map.resize();
    if (!ui.view) { var rb = routeBox(); if (rb) map.fitBox(rb); }
  }
  /* SREPPAGE-END */
