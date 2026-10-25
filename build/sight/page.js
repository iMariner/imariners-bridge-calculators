  /* Tool: Sight Fix (running fix by the Sun, fix by 3 to 4 stars) */
  function initSightFix() {
    var KEY = "bridgeCalc.sightFix", st = store.get(KEY) || {}, mode = st.mode === "stars" ? "stars" : "sun", rowsEl = $("sf-rows"), rowRefs = [], last = null, shipEdited = false;
    var LIMBS = [["L", "Lower"], ["U", "Upper"]];
    var NAMES = Sight.names();
    var FIELDS = ["sf-lat-d", "sf-lat-m", "sf-lon-d", "sf-lon-m", "sf-course", "sf-speed", "sf-date", "sf-zone", "sf-hoe", "sf-ie", "sf-temp", "sf-pres", "sf-gps-lat-d", "sf-gps-lat-m", "sf-gps-lon-d", "sf-gps-lon-m"];
    var RADIOS = ["sf-lat-n", "sf-lat-s", "sf-lon-e", "sf-lon-w", "sf-ie-on", "sf-ie-off", "sf-gps-lat-n", "sf-gps-lat-s", "sf-gps-lon-e", "sf-gps-lon-w"];
    function shipKey() { var s = Ships.active(); return s ? s.id : "_"; }
    function p2(n) { return ("0" + n).slice(-2); }
    function hms(sec) { sec = ((Math.round(sec) % 86400) + 86400) % 86400; return p2(Math.floor(sec / 3600)) + ":" + p2(Math.floor(sec % 3600 / 60)) + ":" + p2(sec % 60); }
    function utText(ms) { var d = new Date(ms); return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + ":" + p2(d.getUTCSeconds()); }
    function alt(deg) { var s = deg < 0 ? "−" : "", a = Math.abs(deg), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 600) / 10; if (m >= 60) { d++; m = 0; } return s + d + "°" + (m < 10 ? "0" : "") + m.toFixed(1) + "'"; }
    function num(s) { s = String(s).trim().replace(",", "."); return /^\d+(\.\d*)?$|^\.\d+$/.test(s) ? parseFloat(s) : NaN; }
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

    /* ---------- the rows of sights ---------- */
    function blankRow(kind) { return kind === "lat" ? { time: "", ld: "", lm: "", ns: "N" } : { name: "", time: "", hd: "", hm: "", limb: "L" }; }
    function rowData() { if (!st.rows) st.rows = {}; var want = mode === "sun" ? ["sun", "sun", "lat"] : ["star", "star", "star", "star"]; var cur = st.rows[mode] || []; return want.map(function (k, i) { var r = cur[i] || blankRow(k === "lat" ? "lat" : "body"); r.kind = k; if (k === "sun") r.name = "Sun"; return r; }); }
    function build() {
      var data = rowData(); st.rows[mode] = data; rowRefs = [];
      while (rowsEl.firstChild) rowsEl.removeChild(rowsEl.firstChild);
      var th = el("thead"), hr = el("tr");
      (mode === "sun" ? ["", "Local time", "Sextant altitude", "", "Limb"] : ["", "Body", "Local time", "Sextant altitude", "", "Limb"]).forEach(function (h, i) { var c = el("th", "", h); if ((mode === "sun" && i === 2) || (mode === "stars" && i === 3)) c.colSpan = 2; if (h === "" && ((mode === "sun" && i === 3) || (mode === "stars" && i === 4))) return; hr.appendChild(c); });
      th.appendChild(hr); rowsEl.appendChild(th);
      var tb = el("tbody"); rowsEl.appendChild(tb);
      data.forEach(function (r, i) {
        var tr = el("tr"), refs = { r: r };
        tr.appendChild(el("td", "n", r.kind === "lat" ? "Lat" : String(i + 1)));
        if (r.kind === "star") { var td = el("td", "w-star"), sel = el("select"); sel.setAttribute("aria-label", "Star " + (i + 1)); var o0 = el("option", "", "choose a body"); o0.value = ""; sel.appendChild(o0);
          [["Sun, Moon and planets", ["Sun", "Moon"].concat(Sight.planets())], ["Stars", NAMES]].forEach(function (g) { var og = document.createElement("optgroup"); og.label = g[0]; g[1].forEach(function (n) { var o = el("option", "", n); o.value = n; og.appendChild(o); }); sel.appendChild(og); });
          sel.value = r.name || ""; sel.addEventListener("change", function () { r.name = sel.value; if (refs.limb) { var lm = r.name === "Moon" || r.name === "Sun"; refs.limb.hidden = !lm; refs.na.hidden = lm; } save(); render(); }); td.appendChild(sel); tr.appendChild(td); refs.sel = sel; }
        var tt = el("td", "w-time"), ti = el("input"); ti.type = "time"; ti.step = "1"; ti.value = r.time || ""; ti.setAttribute("aria-label", "Local time of sight " + (i + 1)); ti.addEventListener("input", function () { r.time = ti.value; r.manual = true; save(); render(); }); tt.appendChild(ti); tr.appendChild(tt); refs.time = ti;
        if (r.kind === "lat") {
          var tl = el("td"); tl.colSpan = 2; var fz = el("div", "fused fused-2"), w1 = el("div", "input-wrap"), w2 = el("div", "input-wrap");
          var a = el("input"); a.type = "text"; a.inputMode = "decimal"; a.placeholder = "Lat °"; a.maxLength = 3; a.value = r.ld || ""; a.setAttribute("aria-label", "Noon latitude degrees");
          var b = el("input"); b.type = "text"; b.inputMode = "decimal"; b.placeholder = "min'"; b.maxLength = 5; b.value = r.lm || ""; b.setAttribute("aria-label", "Noon latitude minutes");
          w1.appendChild(a); w2.appendChild(b); fz.appendChild(w1); fz.appendChild(w2); tl.appendChild(fz); tr.appendChild(tl);
          var tn = el("td", "w-limb"), sn = el("select"); sn.setAttribute("aria-label", "North or South"); ["N", "S"].forEach(function (x) { var o = el("option", "", x === "N" ? "North" : "South"); o.value = x; sn.appendChild(o); }); sn.value = r.ns || "N"; tn.appendChild(sn); tr.appendChild(tn);
          [a, b].forEach(function (x) { x.addEventListener("input", function () { r.ld = a.value; r.lm = b.value; save(); render(); }); }); sn.addEventListener("change", function () { r.ns = sn.value; save(); render(); });
          refs.ld = a; refs.lm = b; refs.ns = sn;
        } else {
          var th2 = el("td"); th2.colSpan = 2; var fz2 = el("div", "fused fused-2"), v1 = el("div", "input-wrap"), v2 = el("div", "input-wrap");
          var hd = el("input"); hd.type = "text"; hd.inputMode = "decimal"; hd.placeholder = "Hs °"; hd.maxLength = 3; hd.value = r.hd || ""; hd.setAttribute("aria-label", "Sextant altitude degrees, sight " + (i + 1));
          var hm = el("input"); hm.type = "text"; hm.inputMode = "decimal"; hm.placeholder = "min'"; hm.maxLength = 5; hm.value = r.hm || ""; hm.setAttribute("aria-label", "Sextant altitude minutes, sight " + (i + 1));
          v1.appendChild(hd); v2.appendChild(hm); fz2.appendChild(v1); fz2.appendChild(v2); th2.appendChild(fz2); tr.appendChild(th2);
          [hd, hm].forEach(function (x) { x.addEventListener("input", function () { r.hd = hd.value; r.hm = hm.value; save(); render(); }); });
          refs.hd = hd; refs.hm = hm;
          if (r.kind === "sun" || r.kind === "star") { var tk = el("td", "w-limb"), sl = el("select"); sl.setAttribute("aria-label", "Limb of the " + (r.kind === "sun" ? "Sun" : "Moon"));
            if (r.kind === "star") { var na = el("span", "small muted", "n/a"); refs.na = na; tk.appendChild(na); var lm0 = r.name === "Moon" || r.name === "Sun"; sl.hidden = !lm0; na.hidden = lm0; } LIMBS.forEach(function (x) { var o = el("option", "", x[1]); o.value = x[0]; sl.appendChild(o); }); sl.value = r.limb || "L"; sl.addEventListener("change", function () { r.limb = sl.value; save(); render(); }); tk.appendChild(sl); tr.appendChild(tk); refs.limb = sl; }
        }
        tb.appendChild(tr); rowRefs.push(refs);
      });
      $("sf-pick").hidden = mode !== "stars";
    }

    /* ---------- reading everything ---------- */
    function pnum(id) { return parseNum($(id)); }
    function read() {
      var errs = {}, v = {};
      v.lat = readDM("sf-lat", 84, "Latitude", errs, "lat"); v.lon = readDM("sf-lon", 180, "Longitude", errs, "lon");
      v.course = pnum("sf-course"); v.speed = pnum("sf-speed"); v.hoe = pnum("sf-hoe"); v.ie = pnum("sf-ie"); v.temp = pnum("sf-temp"); v.pres = pnum("sf-pres"); v.zone = pnum("sf-zone");
      if (isNaN(v.course) || (v.course !== null && (v.course < 0 || v.course > 360))) errs.course = "0 to 360"; if (isNaN(v.speed) || (v.speed !== null && (v.speed < 0 || v.speed > 40))) errs.speed = "0 to 40 kn";
      if (isNaN(v.hoe) || (v.hoe !== null && (v.hoe < 0 || v.hoe > 80))) errs.hoe = "0 to 80 m"; if (isNaN(v.ie) || (v.ie !== null && (v.ie < 0 || v.ie > 30))) errs.ie = "0 to 30'";
      if (isNaN(v.temp) || (v.temp !== null && (v.temp < -40 || v.temp > 60))) errs.temp = 1; if (isNaN(v.pres) || (v.pres !== null && (v.pres < 800 || v.pres > 1100))) errs.pres = 1;
      if (isNaN(v.zone) || (v.zone !== null && (v.zone < -14 || v.zone > 14))) errs.zone = "-14 to +14";
      v.date = parseDateEl($("sf-date"));
      setHint("sf-lat-msg", errs.lat || "0 – 84°", !!errs.lat); setHint("sf-lon-msg", errs.lon || "0 – 180°", !!errs.lon);
      setHint("sf-course-msg", errs.course || "", !!errs.course, $("sf-course")); setHint("sf-speed-msg", errs.speed || "", !!errs.speed, $("sf-speed")); setHint("sf-hoe-msg", errs.hoe || "", !!errs.hoe, $("sf-hoe")); setHint("sf-ie-msg", errs.ie || "", !!errs.ie, $("sf-ie"));
      setHint("sf-zone-msg", errs.zone || "+8 means ship's time = UTC + 8", !!errs.zone, $("sf-zone")); $("sf-temp").setAttribute("aria-invalid", errs.temp ? "true" : "false"); $("sf-pres").setAttribute("aria-invalid", errs.pres ? "true" : "false");
      var g = {}, ge = {}; g.lat = readDM("sf-gps-lat", 90, "GPS latitude", ge, "lat"); g.lon = readDM("sf-gps-lon", 180, "GPS longitude", ge, "lon"); v.gps = g.lat !== null && g.lon !== null && !ge.lat && !ge.lon ? { lat: g.lat * ($("sf-gps-lat-s").checked ? -1 : 1), lon: g.lon * ($("sf-gps-lon-w").checked ? -1 : 1) } : null;
      v.errs = errs; return v;
    }
    function readRows(v) {
      var out = [], bad = [], prev = null, add = 0;
      rowRefs.forEach(function (rf, i) {
        var r = rf.r, sec = parseTimeEl(rf.time), any = (r.kind === "lat" ? (r.ld || r.lm) : (r.hd || r.hm)) !== "" && (r.kind === "lat" ? (r.ld || r.lm) : (r.hd || r.hm)) !== undefined;
        if (r.kind === "star" && !any) return;
        if (r.kind === "lat" && !any && sec === null) return;
        var name = r.kind === "lat" ? "Latitude" : (r.kind === "sun" ? "Sun" : r.name);
        if (!any && sec === null && r.kind !== "star") return;
        if (r.kind === "star" && !r.name) { bad.push("Row " + (i + 1) + ": choose the star."); return; }
        if (sec === null) { bad.push("Row " + (i + 1) + ": enter the time."); return; }
        var d, m, val;
        if (r.kind === "lat") { d = num(r.ld), m = r.lm === "" ? 0 : num(r.lm); if (isNaN(d) || isNaN(m) || d < 0 || d > 90 || m < 0 || m >= 60 || d * 60 + m > 5400) { bad.push("Row " + (i + 1) + ": check the latitude."); return; } val = (d + m / 60) * (r.ns === "S" ? -1 : 1); }
        else { d = num(r.hd); m = r.hm === "" ? 0 : num(r.hm); if (isNaN(d) || isNaN(m) || d < 0 || d > 90 || m < 0 || m >= 60) { bad.push("Row " + (i + 1) + ": check the sextant altitude (degrees 0 to 90, minutes under 60)."); return; } val = d + m / 60; }
        if (prev !== null && sec < prev - 12 * 3600) add += 86400; prev = sec;
        var item = { name: name, secLocal: sec, dayAdd: add };
        if (r.kind === "lat") item.lat = val; else { item.hs = val; item.limb = r.limb || "L"; }
        out.push(item);
      });
      return { rows: out, bad: bad };
    }

    function render() {
      var v = read(), rr = readRows(v), msg = $("sf-rows-msg");
      msg.textContent = rr.bad.join(" "); msg.className = rr.bad.length ? "hint error" : "hint";
      $("sf-pick").disabled = !(v.lat !== null && v.lon !== null && !v.errs.lat && !v.errs.lon && v.date && v.zone !== null && rowRefs.some(function (rf) { return parseTimeEl(rf.time) !== null; }));
      var one = rr.rows.length === 1 && rr.rows[0].name !== "Latitude";
      var ready = !Object.keys(v.errs).length && v.lat !== null && v.lon !== null && (one || (v.course !== null && v.speed !== null)) && v.date && v.zone !== null && v.hoe !== null && (one || rr.rows.length >= 2) && !rr.bad.length;
      var missing = [];
      if (v.lat === null || v.lon === null) missing.push("the DR position"); if (!one && (v.course === null || v.speed === null)) missing.push("course and speed"); if (!v.date) missing.push("the date"); if (v.zone === null) missing.push("the time zone"); if (v.hoe === null) missing.push("height of eye (0 if none)"); if (!rr.rows.length) missing.push("a sight (one sight gives a position line, two or more give a fix)"); else if (!one && rr.rows.length < 2) missing.push("a second sight");
      if (!ready) { $("sf-out").hidden = true; $("sf-sheet").classList.add("no-print"); $("sf-empty").hidden = false; $("sf-empty").className = "empty"; $("sf-empty").textContent = missing.length && !rr.bad.length ? "Still needed: " + missing.join(", ") + "." : "Check the entries marked in red."; last = null; return; }
      var base = Date.UTC(v.date.y, v.date.m - 1, v.date.d), sights = rr.rows.map(function (s) { var o = { name: s.name, ms: base + (s.secLocal - v.zone * 3600) * 1000 + s.dayAdd * 1000 }; if (s.name === "Latitude") o.lat = s.lat; else { o.hs = s.hs; o.limb = s.limb; } return o; });
      var t1 = Math.min.apply(null, sights.map(function (s) { return s.ms; })), side = $("sf-ie-on").checked ? -1 : 1;
      var inp = { dr: { lat: v.lat * ($("sf-lat-s").checked ? -1 : 1), lon: v.lon * ($("sf-lon-w").checked ? -1 : 1), ms: t1, course: v.course === null ? 0 : v.course, speed: v.speed === null ? 0 : v.speed }, hoe: v.hoe, ic: side * (v.ie || 0), temp: v.temp === null ? 10 : v.temp, pres: v.pres === null ? 1010 : v.pres, sights: sights };
      if (v.gps) inp.gps = v.gps;
      var r = one ? SightFix.single(inp) : SightFix.fix(inp);
      if (r.error) { $("sf-out").hidden = true; $("sf-sheet").classList.add("no-print"); $("sf-empty").hidden = false; $("sf-empty").className = "callout warn u-mt-0"; $("sf-empty").textContent = r.error; last = null; return; }
      last = { r: r, v: v, zone: v.zone, inp: inp }; if (r.single) showLine(r, v); else show(r, v);
    }
    function localOf(ms, zone) { return hms(((ms + zone * 3600000) / 1000)); }
    function show(r, v) {
      $("sf-sheet").classList.remove("no-print");
      $("sf-empty").hidden = true; $("sf-out").hidden = false;
      var w = $("sf-warn"); w.hidden = !r.warnings.length; w.textContent = r.warnings.join("\n");
      labels(["Latitude", "Longitude", "From the DR", "Quality"]); $("sf-plotbox").hidden = false; $("sf-legend").textContent = LEG_FIX; $("sf-ps-plot").style.display = "";
      $("sf-f-lat").textContent = Geo.lat(r.fix.lat); $("sf-f-lon").textContent = Geo.lon(r.fix.lon);
      $("sf-f-time").textContent = "at " + localOf(r.time, v.zone) + " local"; $("sf-f-ut").textContent = utText(r.time) + " UT";
      $("sf-f-set").textContent = r.setDeg === null ? "on the DR" : Math.round(r.setDeg) + "° " + r.distNM.toFixed(1) + " NM";
      $("sf-f-set-sub").textContent = r.setDeg === null ? "no difference" : "the fix is this far, this way, from the DR";
      var q = "—", qs = "";
      if (r.cutDeg !== undefined) { q = "cut " + r.cutDeg + "°"; qs = r.cutDeg >= 60 ? "good" : r.cutDeg >= 30 ? "acceptable" : "weak"; }
      else if (r.hatNM !== undefined) { q = "hat " + r.hatNM.toFixed(1) + " NM"; qs = r.hatNM < 3 ? "small: good" : r.hatNM < 6 ? "moderate" : "large: check the sights"; }
      else if (r.residuals && r.residuals.length) { var mx = Math.max.apply(null, r.residuals.map(Math.abs)); q = "±" + mx.toFixed(1) + "'"; qs = "worst line miss"; }
      if (r.constErr !== undefined) qs += (qs ? "; " : "") + "constant error " + (r.constErr >= 0 ? "+" : "−") + Math.abs(r.constErr).toFixed(1) + "'" + (r.fixC ? ", fix with it removed " + Geo.lat(r.fixC.lat) + " " + Geo.lon(r.fixC.lon) : "");
      $("sf-f-q").textContent = q; $("sf-f-q-sub").textContent = qs;
      sightsTable($("sf-tbl"), r, v);
      var ft = r.fix; var line = methodText(r) + " " + localOf(r.time, v.zone) + " LT (" + utText(r.time) + " UT): " + Geo.lat(ft.lat) + " " + Geo.lon(ft.lon) + (r.setDeg === null ? "" : " | " + Math.round(r.setDeg) + "° " + r.distNM.toFixed(1) + " NM from DR") + (r.gpsErrNM !== undefined ? " | GPS difference " + r.gpsErrNM.toFixed(1) + " NM" : "");
      $("sf-log").textContent = line;
      work($("sf-work-tbl"), r, v); sheet(r, v);
    }
    var LEG_FIX = $("sf-legend").textContent;
    function labels(t) { ["sf-l1", "sf-l2", "sf-l3", "sf-l4"].forEach(function (id, i) { $(id).textContent = t[i]; }); }
    function showLine(r, v) {                                                      /* one sight: position line and longitude by chronometer */
      $("sf-sheet").classList.remove("no-print"); $("sf-empty").hidden = true; $("sf-out").hidden = false;
      var s = r.sights[0], w = $("sf-warn"); w.hidden = !r.warnings.length; w.textContent = r.warnings.join("\n");
      var byLat = r.lonChron === null && r.latChron !== undefined;
      labels(["Intercept", "Azimuth Zn", byLat ? "Latitude" : "Longitude by chronometer", "Position line"]);
      $("sf-f-lat").textContent = Math.abs(s.a).toFixed(1) + "' " + (s.a >= 0 ? "toward" : "away"); $("sf-f-time").textContent = "at " + localOf(r.time, v.zone) + " local";
      $("sf-f-lon").textContent = s.zn.toFixed(1) + "°"; $("sf-f-ut").textContent = utText(r.time) + " UT";
      $("sf-f-set").textContent = byLat ? Geo.lat(r.latChron) : r.lonChron === null ? "—" : Geo.lon(r.lonChron);
      $("sf-f-set-sub").textContent = byLat ? "on the DR longitude " + Geo.lon(s.ap.lon) + " (the body bears near " + (Math.cos(s.zn * Math.PI / 180) > 0 ? "north" : "south") + ")" : r.lonChron === null ? "not usable for this bearing" : "on the DR latitude " + Geo.lat(s.ap.lat);
      $("sf-f-q").textContent = p3(r.lop[0]) + "° / " + p3(r.lop[1]) + "°"; $("sf-f-q-sub").textContent = "through the ITP " + Geo.lat(r.itp.lat) + " " + Geo.lon(r.itp.lon);
      sightsTable($("sf-tbl"), r, v); $("sf-plotbox").hidden = false; $("sf-plot").innerHTML = linePlot(r, 720, 540, "sfc1"); $("sf-legend").textContent = "Solid: the position line through the ITP. Red dashes: the intercept from the DR. Arrow: towards the body. Diamond: " + (r.lonChron === null && r.latChron !== undefined ? "the latitude at the DR longitude." : "the longitude by chronometer on the DR latitude.");
      $("sf-log").textContent = s.name + " position line " + localOf(r.time, v.zone) + " LT (" + utText(r.time) + " UT): intercept " + Math.abs(s.a).toFixed(1) + "' " + (s.a >= 0 ? "toward" : "away") + ", Zn " + s.zn.toFixed(1) + "°, ITP " + Geo.lat(r.itp.lat) + " " + Geo.lon(r.itp.lon) + ", line " + p3(r.lop[0]) + "°/" + p3(r.lop[1]) + "°" + (byLat ? " | latitude " + Geo.lat(r.latChron) + " on DR long " + Geo.lon(s.ap.lon) : r.lonChron === null ? "" : " | longitude by chronometer " + Geo.lon(r.lonChron) + " on DR lat " + Geo.lat(s.ap.lat));
      work($("sf-work-tbl"), r, v); sheetLine(r, v);
    }
    function dsp(s) {                                                              /* figures as in the Almanac working (the Moon: geocentric Hc, parallax added to Ho) */
      return s.kind === "moon" ? { ho: s.ho + s.pa / 60, hc: s.hcGeo, lha: s.lhaGeo } : { ho: s.ho, hc: s.hc, lha: s.lha };
    }
    function linePlot(r, W, H, id) {                                               /* the one position line drawn through its ITP */
      var s = r.sights[0], c = {}, k; for (k in s) c[k] = s[k]; c.hcFix = s.ho;
      var mark = r.lonChron !== null ? { lat: s.ap.lat, lon: r.lonChron, label: "Long. by chron " + Geo.lon(r.lonChron) } : r.latChron !== undefined ? { lat: r.latChron, lon: s.ap.lon, label: "Lat. " + Geo.lat(r.latChron) } : null;
      return SightPlot.build({ fix: r.itp, time: r.time, sights: [c] }, { dr: { lat: s.ap.lat, lon: s.ap.lon, ms: r.time, course: 0, speed: 0 } }, W, H, id, { single: true, mark: mark });
    }
    function methodText(r) {                                                       /* "Running fix by Sun", "Fix by stars", or the bodies by name */
      var nm = r.sights.filter(function (s) { return s.name !== "Latitude"; }).map(function (s) { return s.name; }), lat = nm.length < r.sights.length ? " and latitude" : "";
      if (nm.every(function (n) { return n === "Sun"; })) return "Running fix by Sun" + lat;
      if (nm.every(function (n) { return n !== "Sun" && n !== "Moon" && Sight.planets().indexOf(n) < 0; })) return "Fix by stars" + lat;
      return "Fix by " + nm.join(", ") + lat;
    }
    function p3(x) { return ("00" + Math.round(x) % 360).slice(-3); }
    function sightsTable(tbl, r, v) {
      while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var hh = el("tr"); ["Body", "Local time", "Hs", "Ho", "Hc", "Intercept", "Zn"].forEach(function (h) { hh.appendChild(el("th", "", h)); }); var th = el("thead"); th.appendChild(hh); tbl.appendChild(th); var tb = el("tbody"); tbl.appendChild(tb);
      r.sights.forEach(function (s, i) {
        var tr = el("tr"), hs = last_hs(i);
        tr.appendChild(el("td", "", s.name)); tr.appendChild(el("td", "", localOf(s.ms, v.zone)));
        if (s.name === "Latitude") { [Geo.lat(last.inp.sights[i].lat), "", "", Math.abs(s.a).toFixed(1) + " NM " + (s.a >= 0 ? "N" : "S"), "000°"].forEach(function (t) { tr.appendChild(el("td", "num", t)); }); }
        else [hs, alt(dsp(s).ho), alt(dsp(s).hc), Math.abs(s.a).toFixed(1) + " " + (s.a >= 0 ? "toward" : "away"), s.zn.toFixed(1) + "°"].forEach(function (t) { tr.appendChild(el("td", "num", t)); });
        tb.appendChild(tr);
      });
    }
    function sheet(r, v) {
      var sh = Ships.active(), i = last.inp, ic = i.ic;
      $("sf-plot").innerHTML = SightPlot.build(r, i, 720, 540, "sfc1");
      $("sf-ps-plot").innerHTML = SightPlot.build(r, i, 760, 300, "sfc2");
      fillCells($("sf-ps-info"), [["Ship", sh ? sh.name : "—"], ["IMO number", sh && sh.imo ? sh.imo : "—"], ["Date (ship's time)", p2(v.date.d) + "/" + p2(v.date.m) + "/" + v.date.y], ["Time zone", (v.zone >= 0 ? "UTC +" : "UTC −") + Math.abs(v.zone) + " h"],
        ["DR at first sight", Geo.lat(i.dr.lat) + " " + Geo.lon(i.dr.lon), 2], ["Course / speed", Math.round(v.course) + "° / " + v.speed + " kn"], ["Height of eye", v.hoe + " m"],
        ["Index error", (ic === 0 ? "nil" : Math.abs(ic).toFixed(1) + "' " + (ic < 0 ? "on" : "off") + " the arc")], ["Temp / pressure", i.temp + " °C / " + i.pres + " hPa"], ["Method", methodText(r), 2]]);
      sightsTable($("sf-ps-tbl"), r, v); work($("sf-ps-work"), r, v);
      $("sf-ps-l1").textContent = "Latitude"; $("sf-ps-l2").textContent = "Longitude";
      $("sf-ps-lat").textContent = Geo.lat(r.fix.lat); $("sf-ps-lon").textContent = Geo.lon(r.fix.lon);
      var t = $("sf-log").textContent;
      $("sf-ps-log").textContent = t;
      var qn = $("sf-f-q").textContent + ($("sf-f-q-sub").textContent ? " (" + $("sf-f-q-sub").textContent + ")" : "");
      $("sf-ps-warn").textContent = "Quality: " + qn + (r.warnings.length ? ". Warnings: " + r.warnings.join(" ") : ". No warnings.");
    }
    function sheetLine(r, v) {
      var sh = Ships.active(), i = last.inp, ic = i.ic, s = r.sights[0];
      $("sf-ps-plot").innerHTML = linePlot(r, 760, 300, "sfc2"); $("sf-ps-plot").style.display = "";
      fillCells($("sf-ps-info"), [["Ship", sh ? sh.name : "—"], ["IMO number", sh && sh.imo ? sh.imo : "—"], ["Date (ship's time)", p2(v.date.d) + "/" + p2(v.date.m) + "/" + v.date.y], ["Time zone", (v.zone >= 0 ? "UTC +" : "UTC −") + Math.abs(v.zone) + " h"],
        ["DR at the sight", Geo.lat(i.dr.lat) + " " + Geo.lon(i.dr.lon), 2], ["Height of eye", v.hoe + " m"], ["Index error", (ic === 0 ? "nil" : Math.abs(ic).toFixed(1) + "' " + (ic < 0 ? "on" : "off") + " the arc")],
        ["Temp / pressure", i.temp + " °C / " + i.pres + " hPa"], ["Method", r.lonChron === null && r.latChron !== undefined ? "Position line and latitude" + (s.name === "Polaris" ? " by Pole Star" : "") : "Position line and longitude by chronometer", 3]]);
      sightsTable($("sf-ps-tbl"), r, v); work($("sf-ps-work"), r, v);
      if (r.lonChron === null && r.latChron !== undefined) { $("sf-ps-l1").textContent = "Latitude (observed)"; $("sf-ps-l2").textContent = "DR longitude"; $("sf-ps-lat").textContent = Geo.lat(r.latChron); $("sf-ps-lon").textContent = Geo.lon(s.ap.lon); }
      else { $("sf-ps-l1").textContent = "DR latitude"; $("sf-ps-l2").textContent = "Longitude by chronometer"; $("sf-ps-lat").textContent = Geo.lat(s.ap.lat); $("sf-ps-lon").textContent = r.lonChron === null ? "not usable" : Geo.lon(r.lonChron); }
      $("sf-ps-log").textContent = $("sf-log").textContent;
      $("sf-ps-warn").textContent = r.warnings.length ? "Warnings: " + r.warnings.join(" ") : "No warnings.";
    }
    function last_dr_ms(r) { return last.inp.dr.ms; }
    function last_hs(i) { var s = last.inp.sights[i]; return s.hs === undefined ? "" : alt(s.hs); }
    function work(tbl, r, v) {
      while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var body = r.sights.filter(function (s) { return s.name !== "Latitude"; });
      var th = el("thead"), hr = el("tr"); hr.appendChild(el("th", "", "Step")); var cnt = {}; body.forEach(function (s) { cnt[s.name] = (cnt[s.name] || 0) + 1; }); var seen = {}; body.forEach(function (s) { seen[s.name] = (seen[s.name] || 0) + 1; hr.appendChild(el("th", "", s.name + (cnt[s.name] > 1 ? " " + seen[s.name] : ""))); }); th.appendChild(hr); tbl.appendChild(th); var tb = el("tbody"); tbl.appendChild(tb);
      function row(label, f) { var tr = el("tr"); tr.appendChild(el("td", "", label)); body.forEach(function (s, i) { tr.appendChild(el("td", "num", f(s, i))); }); tb.appendChild(tr); }
      var idxOf = function (s) { return r.sights.indexOf(s); };
      row("UT", function (s) { return utText(s.ms); }); row("DR (assumed position)", function (s) { return Geo.lat(s.ap.lat) + " " + Geo.lon(s.ap.lon); });
      row("GHA", function (s) { return alt(s.gha); }); row("Declination", function (s) { return (s.dec < 0 ? "S " : "N ") + alt(Math.abs(s.dec)); }); row("LHA", function (s) { return alt(dsp(s).lha); });
      row("Sextant altitude Hs", function (s) { return last_hs(idxOf(s)); });
      row("Index correction", function (s) { var ic = last.inp.ic; return (ic >= 0 ? "+" : "−") + Math.abs(ic).toFixed(1) + "'"; });
      row("Dip (height of eye)", function (s) { return "−" + s.corr.dip.toFixed(1) + "'"; }); row("Apparent altitude", function (s) { return alt(s.corr.ha); });
      row("Refraction", function (s) { return "−" + s.corr.ref.toFixed(1) + "'"; }); row("Semi-diameter", function (s) { return s.corr.sd === 0 ? "—" : (s.corr.sd > 0 ? "+" : "−") + Math.abs(s.corr.sd).toFixed(1) + "'"; }); row("Parallax in altitude", function (s) { return s.kind === "moon" ? "+" + s.pa.toFixed(1) + "' (HP " + s.hp.toFixed(1) + "')" : s.corr.par === 0 ? "—" : "+" + s.corr.par.toFixed(1) + "'"; });
      row("Observed altitude Ho", function (s) { return alt(dsp(s).ho); }); row("Calculated altitude Hc", function (s) { return alt(dsp(s).hc); }); row("Intercept (Ho − Hc)", function (s) { return Math.abs(s.a).toFixed(1) + "' " + (s.a >= 0 ? "toward" : "away"); }); row("Azimuth Zn", function (s) { return s.zn.toFixed(1) + "°"; });
    }

    /* ---------- saving and loading ---------- */
    function save() {
      var o = st; o.mode = mode; o.f = {}; FIELDS.forEach(function (id) { o.f[id] = $(id).value; }); o.r = RADIOS.filter(function (id) { return $(id).checked; });
      if (!o.ship) o.ship = {}; if (shipEdited) o.ship[shipKey()] = { hoe: $("sf-hoe").value, ie: $("sf-ie").value, off: $("sf-ie-off").checked };
      store.set(KEY, o);
    }
    function load() {
      if (st.f) FIELDS.forEach(function (id) { if (st.f[id] !== undefined) $(id).value = st.f[id]; });
      (st.r || []).forEach(function (id) { if ($(id)) $(id).checked = true; });
      shipFill();
      if (!$("sf-date").value) $("sf-date").value = todayISO();
      $("sf-mode-" + mode).checked = true;
    }
    function shipFill() { shipEdited = false; var sh = (st.ship && st.ship[shipKey()]) || { hoe: "", ie: "", off: false }; $("sf-hoe").value = sh.hoe; $("sf-ie").value = sh.ie; (sh.off ? $("sf-ie-off") : $("sf-ie-on")).checked = true; }

    /* ---------- the buttons ---------- */
    function pickStars() {
      var v = read(); if (v.lat === null || v.lon === null || !v.date || v.zone === null) return;
      var first = rowRefs.filter(function (rf) { return parseTimeEl(rf.time) !== null; })[0];
      var sec = first ? parseTimeEl(first.time) : null; if (sec === null) { toast("Type the time of the first sight, then pick."); return; }
      var ms = Date.UTC(v.date.y, v.date.m - 1, v.date.d) + (sec - v.zone * 3600) * 1000;
      var pick = Sight.suggest(ms, v.lat * ($("sf-lat-s").checked ? -1 : 1), v.lon * ($("sf-lon-w").checked ? -1 : 1), 4);
      if (!pick.length) { toast("No good stars are up at that time."); return; }
      var data = st.rows.stars; var n = 0; data.forEach(function (r) { if (r.hd || r.hm) return; var p = pick[n++]; r.name = p ? p.name : ""; if (p && !r.time) r.time = hms(sec); });
      build(); save(); render(); toast("Best stars for that time: " + pick.map(function (p) { return p.name + " " + Math.round(p.hc) + "°/" + Math.round(p.zn) + "°"; }).join(", "));
    }
    function example() {
      var set = function (id, val) { $(id).value = val; }, key = shipKey(), prior = st.ship && st.ship[key] ? JSON.parse(JSON.stringify(st.ship[key])) : null;
      if (mode === "stars") {
        set("sf-lat-d", "21"); set("sf-lat-m", "22.2"); $("sf-lat-n").checked = true; set("sf-lon-d", "37"); set("sf-lon-m", "57.2"); $("sf-lon-e").checked = true; set("sf-course", "332"); set("sf-speed", "12.4"); set("sf-date", "2026-04-14"); set("sf-zone", "2"); set("sf-hoe", "29"); set("sf-ie", "0"); $("sf-ie-on").checked = true; set("sf-temp", "27"); set("sf-pres", "1010");
        st.rows = st.rows || {}; st.rows.stars = [["Fomalhaut", "04:48:00", "11", "30.6"], ["Spica", "04:48:33", "4", "36.8"], ["Schedar", "04:48:55", "19", "04.5"], ["", "", "", ""]].map(function (x) { return { kind: "star", name: x[0], time: x[1], hd: x[2], hm: x[3], limb: "L" }; });
      } else {
        set("sf-lat-d", "22"); set("sf-lat-m", "54.6"); $("sf-lat-n").checked = true; set("sf-lon-d", "94"); set("sf-lon-m", "25.3"); $("sf-lon-w").checked = true; set("sf-course", "332"); set("sf-speed", "12.4"); set("sf-date", "2021-05-06"); set("sf-zone", "-5"); set("sf-hoe", "29"); set("sf-ie", "0"); $("sf-ie-on").checked = true; set("sf-temp", "27"); set("sf-pres", "1010");
        st.rows = st.rows || {}; st.rows.sun = [["13:48:55", "79", "41.0"], ["17:06:55", "35", "15.0"]].map(function (x) { return { kind: "sun", name: "Sun", time: x[0], hd: x[1], hm: x[2], limb: "L" }; }).concat([{ kind: "lat", time: "", ld: "", lm: "", ns: "N" }]);
      }
      shipEdited = false; build(); save(); if (st.ship) { if (prior) st.ship[key] = prior; else delete st.ship[key]; store.set(KEY, st); } render(); toast("Example loaded (from the owner's old workbook)");
    }
    function clearSights() { st.rows[mode] = null; build(); save(); render(); }

    $("sf-form").addEventListener("input", function () { save(); render(); });
    $("sf-form").addEventListener("change", function () { save(); render(); });
    ["sf-mode-sun", "sf-mode-stars"].forEach(function (id) { $(id).addEventListener("change", function () { mode = $("sf-mode-stars").checked ? "stars" : "sun"; build(); save(); render(); }); });
    ["sf-hoe", "sf-ie"].forEach(function (id) { $(id).addEventListener("input", function () { shipEdited = true; }); }); ["sf-ie-on", "sf-ie-off"].forEach(function (id) { $(id).addEventListener("change", function () { shipEdited = true; }); });
    $("sf-pick").addEventListener("click", pickStars); $("sf-example").addEventListener("click", example); $("sf-clear").addEventListener("click", clearSights);
    $("sf-print").addEventListener("click", function () { if (last) window.print(); });
    $("sf-copy").addEventListener("click", function () { if (last) copyText($("sf-log").textContent); });
    Ships.onChange(function () { if (started["sight-fix"]) { shipFill(); render(); } });
    load(); build(); render();
  }
  /* SIGHTPAGE-END */
