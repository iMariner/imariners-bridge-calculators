  /* Tool: Passage Plan (waypoints, rhumb line and great circle legs) */
  function initPassagePlan() {
    var KEY = "bridgeCalc.passagePlan", st = store.get(KEY) || {}, rowsEl = $("pp-rows"), MAX = 30, last = null;
    if (!Array.isArray(st.wps) || !st.wps.length) st.wps = [blank(), blank()];
    function blank() { return { name: "", ld: "", lm: "", ns: "N", od: "", om: "", ew: "E", leg: "RL" }; }
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
    function inp(val, ph, max, label, onIn) { var w = el("div", "input-wrap"), i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.placeholder = ph; i.maxLength = max; i.value = val || ""; i.setAttribute("aria-label", label); i.addEventListener("input", function () { onIn(i.value); }); w.appendChild(i); return w; }
    function sel(opts, val, label, onCh) { var s = el("select", "text-input"); opts.forEach(function (o) { var x = el("option", "", o[1]); x.value = o[0]; s.appendChild(x); }); s.value = val; s.setAttribute("aria-label", label); s.addEventListener("change", function () { onCh(s.value); }); return s; }
    function unit(w, u) { var s = el("span", "unit", u); w.appendChild(s); return w; }
    function build() {
      while (rowsEl.firstChild) rowsEl.removeChild(rowsEl.firstChild);
      var th = el("thead"), hr = el("tr"); ["", "Waypoint", "Latitude", "Longitude", "Leg to the next", ""].forEach(function (h) { hr.appendChild(el("th", "", h)); }); th.appendChild(hr); rowsEl.appendChild(th);
      var tb = el("tbody"); rowsEl.appendChild(tb);
      st.wps.forEach(function (w, i) {
        var tr = el("tr"), n = i + 1, set = function (k) { return function (v) { w[k] = v; save(); render(); }; };
        tr.appendChild(el("td", "n", String(n)));
        var tn = el("td", "w-name"), nm = el("input", "text-input"); nm.type = "text"; nm.maxLength = 30; nm.placeholder = "WP " + n; nm.value = w.name || ""; nm.setAttribute("aria-label", "Name of waypoint " + n); nm.addEventListener("input", function () { w.name = nm.value; save(); render(); }); tn.appendChild(nm); tr.appendChild(tn);
        var tl = el("td", "w-pos"), dl = el("div", "ge-dm"); dl.appendChild(unit(inp(w.ld, "0", 2, "Latitude degrees, waypoint " + n, set("ld")), "°")); dl.appendChild(unit(inp(w.lm, "0.0", 5, "Latitude minutes, waypoint " + n, set("lm")), "'")); dl.appendChild(sel([["N", "N"], ["S", "S"]], w.ns, "North or south, waypoint " + n, set("ns"))); tl.appendChild(dl); tr.appendChild(tl);
        var to = el("td", "w-pos"), dn = el("div", "ge-dm"); dn.appendChild(unit(inp(w.od, "0", 3, "Longitude degrees, waypoint " + n, set("od")), "°")); dn.appendChild(unit(inp(w.om, "0.0", 5, "Longitude minutes, waypoint " + n, set("om")), "'")); dn.appendChild(sel([["E", "E"], ["W", "W"]], w.ew, "East or west, waypoint " + n, set("ew"))); to.appendChild(dn); tr.appendChild(to);
        var tg = el("td", "w-leg"); if (i < st.wps.length - 1) tg.appendChild(sel([["RL", "Rhumb line"], ["GC", "Great circle"]], w.leg || "RL", "Leg from waypoint " + n, set("leg"))); else tg.appendChild(el("span", "small muted", "end of passage")); tr.appendChild(tg);
        var tx = el("td"), b = el("button", "btn", "Remove"); b.type = "button"; b.setAttribute("aria-label", "Remove waypoint " + n); b.disabled = st.wps.length <= 2; b.addEventListener("click", function () { st.wps.splice(i, 1); build(); save(); render(); }); tx.appendChild(b); tr.appendChild(tx);
        tb.appendChild(tr);
      });
      $("pp-add").disabled = st.wps.length >= MAX;
    }
    function num(s) { s = String(s === undefined ? "" : s).trim().replace(",", "."); if (s === "") return null; return /^\d+(\.\d*)?$|^\.\d+$/.test(s) ? parseFloat(s) : NaN; }
    function pos(w, i, bad) {
      var a = num(w.ld), b = num(w.lm), c = num(w.od), d = num(w.om);
      if (a === null && b === null && c === null && d === null) return null;
      if (a === null || c === null || isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d) || a > 85 || (b || 0) >= 60 || c > 180 || (d || 0) >= 60 || a * 60 + (b || 0) > 5100 || c * 60 + (d || 0) > 10800) { bad.push("Waypoint " + (i + 1) + ": check the position (latitude 0 to 85°, longitude 0 to 180°, minutes under 60)."); return null; }
      return { lat: (a + (b || 0) / 60) * (w.ns === "S" ? -1 : 1), lon: (c + (d || 0) / 60) * (w.ew === "W" ? -1 : 1) };
    }
    function p3(x) { return ("00" + (Math.round(x) % 360)).slice(-3); }
    function c1(x) { var s = (Math.round(x * 10) / 10 % 360).toFixed(1); return ("00" + s).slice(-5); }
    function nm(x) { return x.toFixed(1); }
    function hrs(h) { var m = Math.round(h * 60), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60); return (d ? d + " d " : "") + hh + " h " + ("0" + (m % 60)).slice(-2) + " m"; }
    function render() {
      var bad = [], P = [], gaps = false;
      st.wps.forEach(function (w, i) { var p = pos(w, i, bad); if (p) P.push({ p: p, w: w, i: i }); else if (!bad.length || bad[bad.length - 1].indexOf("Waypoint " + (i + 1) + ":") < 0) gaps = true; });
      var lim = num($("pp-limit").value), spd = num($("pp-speed").value), step = parseFloat($("pp-step").value) || 5;
      var limBad = lim !== null && (isNaN(lim) || lim < 20 || lim > 80), spdBad = spd !== null && (isNaN(spd) || spd <= 0 || spd > 40);
      setHint("pp-limit-msg", limBad ? "20 to 80 degrees" : "a great circle will not go beyond it (composite)", limBad, $("pp-limit")); setHint("pp-speed-msg", spdBad ? "0.1 to 40 kn" : "", spdBad, $("pp-speed"));
      $("pp-rows-msg").textContent = bad.join(" "); $("pp-rows-msg").className = bad.length ? "hint error" : "hint";
      if (bad.length || P.length < 2 || limBad || spdBad) { $("pp-out").hidden = true; $("pp-empty").hidden = false; $("pp-empty").textContent = bad.length || limBad || spdBad ? "Check the entries marked in red." : "Enter at least two waypoints."; $("pp-sheet").classList.add("no-print"); last = null; return; }
      if (gaps) bad.push("Empty rows are skipped.");
      var route = [], legs = [], warn = [], total = 0, rlTotal = 0;
      for (var k = 0; k < P.length - 1; k++) {
        var a = P[k], b = P[k + 1], L = Passage.leg(a.p, b.p, { type: a.w.leg === "GC" ? "GC" : "RL", step: step, limit: lim });
        L.fromName = a.w.name || "WP " + (a.i + 1); L.toName = b.w.name || "WP " + (b.i + 1); legs.push(L);
        L.warnings.forEach(function (x) { warn.push(L.fromName + " to " + L.toName + ": " + x); });
        if (L.rlDist > 3000 && L.type === "RL") warn.push(L.fromName + " to " + L.toName + ": a " + Math.round(L.rlDist) + " NM rhumb line. A great circle may be shorter; see the saving if you switch this leg.");
        L.subs.forEach(function (s, j) {
          var lim = L.type === "CGC" && ((Math.abs(s.from.lat - L.V1.lat) < 1e-9 && Math.abs(s.from.lon - L.V1.lon) < 1e-9) || (Math.abs(s.from.lat - L.V2.lat) < 1e-9 && Math.abs(s.from.lon - L.V2.lon) < 1e-9));
          route.push({ wp: j === 0 ? String(a.i + 1) : "", name: j === 0 ? L.fromName : "GC " + (a.i + 1) + "." + j + (lim ? " (limit)" : ""), p: s.from, course: s.course, dist: s.dist, gc: j > 0 });
        });
        total += L.sailed; rlTotal += L.rlDist;
      }
      var lastP = P[P.length - 1]; route.push({ wp: String(lastP.i + 1), name: lastP.w.name || "WP " + (lastP.i + 1), p: lastP.p, course: null, dist: null });
      var run = 0; route.forEach(function (r) { r.cum = run; r.togo = total - run; if (r.dist) run += r.dist; });
      last = { route: route, legs: legs, total: total, spd: spd, rlTotal: rlTotal };
      $("pp-empty").hidden = true; $("pp-out").hidden = false; $("pp-sheet").classList.remove("no-print");
      $("pp-warn").hidden = !warn.length; $("pp-warn").textContent = warn.join("\n");
      $("pp-h-dist").textContent = nm(total) + " NM"; $("pp-h-dist-sub").textContent = legs.length + (legs.length === 1 ? " leg" : " legs") + ", as sailed";
      var save = rlTotal - total, anyGC = legs.some(function (l) { return l.type !== "RL"; });
      $("pp-h-save").textContent = anyGC ? nm(save) + " NM" : "—"; $("pp-h-save-sub").textContent = anyGC ? "against rhumb lines on the same legs" : "no great circle legs";
      $("pp-h-time").textContent = spd ? hrs(total / spd) : "—"; $("pp-h-time-sub").textContent = spd ? "at " + spd + " kn" : "enter a speed";
      $("pp-h-wps").textContent = String(route.length); $("pp-h-wps-sub").textContent = route.length - P.length ? "incl. " + (route.length - P.length) + " great circle points" : "as entered";
      table($("pp-route")); notes($("pp-notes")); sheet();
    }
    function table(tbl) {
      while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var th = el("thead"), hr = el("tr"); ["WP", "Waypoint", "Latitude", "Longitude", "Course to next", "Dist. to next", "From start", "To go"].concat(last.spd ? ["Time from start"] : []).forEach(function (h) { hr.appendChild(el("th", "", h)); }); th.appendChild(hr); tbl.appendChild(th);
      var tb = el("tbody"); tbl.appendChild(tb);
      last.route.forEach(function (r, i) {
        var tr = el("tr", r.gc ? "gc" : ""); [r.wp, r.name, Geo.lat(r.p.lat), Geo.lon(r.p.lon), r.course === null ? "" : c1(r.course) + "°", r.dist === null ? "" : nm(r.dist), nm(r.cum), nm(r.togo)].concat(last.spd ? [hrs(r.cum / last.spd)] : []).forEach(function (t) { tr.appendChild(el("td", "", t)); });
        tb.appendChild(tr);
      });
    }
    function notes(box) {
      while (box.firstChild) box.removeChild(box.firstChild);
      last.legs.forEach(function (L) {
        if (L.type === "RL") return;
        var t = L.fromName + " to " + L.toName + ": " + (L.type === "CGC" ? "composite great circle, limit " + Geo.lat(L.V1.lat) + ", along the limit from " + Geo.lon(L.V1.lon) + " to " + Geo.lon(L.V2.lon) + " (" + nm(L.parallel) + " NM)" : "great circle") +
          ". Initial course " + c1(L.course) + "°, final " + c1(L.finalCourse) + "°, distance " + nm(L.gcDist) + " NM (" + nm(L.sailed) + " NM sailed on the rhumb lines between the points)" + (L.vertex ? ", vertex " + Geo.lat(L.vertex.lat) + " " + Geo.lon(L.vertex.lon) : "") + ". Rhumb line instead: " + nm(L.rlDist) + " NM.";
        box.appendChild(el("p", "", t));
      });
    }
    function sheet() {
      var sh = Ships.active();
      fillCells($("pp-ps-info"), [["Ship", sh ? sh.name : "—"], ["IMO number", sh && sh.imo ? sh.imo : "—"], ["From", last.route[0].name], ["To", last.route[last.route.length - 1].name],
        ["Total distance", nm(last.total) + " NM"], ["Planned speed", last.spd ? last.spd + " kn" : "—"], ["Time at that speed", last.spd ? hrs(last.total / last.spd) : "—"], ["Waypoints", String(last.route.length)]]);
      table($("pp-ps-route")); notes($("pp-ps-notes"));
    }
    function save() { st.step = $("pp-step").value; st.limit = $("pp-limit").value; st.speed = $("pp-speed").value; store.set(KEY, st); }
    function routeText() {
      var lines = [["WP", "Waypoint", "Latitude", "Longitude", "Course to next", "Dist. to next NM", "From start NM", "To go NM"].join("\t")];
      last.route.forEach(function (r, i) { lines.push([r.wp, r.name, Geo.lat(r.p.lat), Geo.lon(r.p.lon), r.course === null ? "" : c1(r.course), r.dist === null ? "" : nm(r.dist), nm(r.cum), nm(r.togo)].join("\t")); });
      return lines.join("\n");
    }
    $("pp-step").value = st.step || "5"; $("pp-limit").value = st.limit || ""; $("pp-speed").value = st.speed || "";
    ["pp-limit", "pp-speed"].forEach(function (id) { $(id).addEventListener("input", function () { save(); render(); }); });
    $("pp-step").addEventListener("change", function () { save(); render(); });
    $("pp-add").addEventListener("click", function () { if (st.wps.length < MAX) { var p = st.wps[st.wps.length - 1]; st.wps.push({ name: "", ld: "", lm: "", ns: p.ns, od: "", om: "", ew: p.ew, leg: "RL" }); build(); save(); render(); } });
    $("pp-clear").addEventListener("click", function () { st.wps = [blank(), blank()]; build(); save(); render(); });
    $("pp-example").addEventListener("click", function () {
      st.wps = [{ name: "Tokyo Bay pilot", ld: "35", lm: "05.0", ns: "N", od: "139", om: "45.0", ew: "E", leg: "RL" }, { name: "Off Nojima Saki", ld: "34", lm: "50.0", ns: "N", od: "140", om: "00.0", ew: "E", leg: "GC" },
        { name: "Off Point Reyes", ld: "37", lm: "50.0", ns: "N", od: "123", om: "30.0", ew: "W", leg: "RL" }, { name: "San Francisco pilot", ld: "37", lm: "45.0", ns: "N", od: "122", om: "40.0", ew: "W", leg: "RL" }];
      $("pp-limit").value = ""; $("pp-speed").value = "14"; $("pp-step").value = "5"; build(); save(); render(); toast("Example loaded: Tokyo to San Francisco by great circle");
    });
    $("pp-copy").addEventListener("click", function () { if (last) copyText(routeText()); });
    $("pp-print").addEventListener("click", function () { if (last) window.print(); });
    Ships.onChange(function () { if (started["passage-plan"] && last) sheet(); });
    build(); render();
  }

