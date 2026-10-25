  /* Tool: Sight Fix (running fix by the Sun, fix by 3 to 4 stars) */
  function initSightFix() {
    var KEY = "bridgeCalc.sightFix", st = store.get(KEY) || {}, mode = st.mode === "stars" ? "stars" : "sun", rowsEl = $("sf-rows"), rowRefs = [], last = null;
    var LIMBS = [["L", "Lower limb"], ["U", "Upper limb"]];
    var NAMES = Sight.names().filter(function (n) { return n !== "Polaris"; });
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
      (mode === "sun" ? ["", "Local time", "Sextant altitude", "", "Limb"] : ["", "Star", "Local time", "Sextant altitude", ""]).forEach(function (h, i) { var c = el("th", "", h); if ((mode === "sun" && i === 2) || (mode === "stars" && i === 3)) c.colSpan = 2; if (h === "" && ((mode === "sun" && i === 3) || (mode === "stars" && i === 4))) return; hr.appendChild(c); });
      th.appendChild(hr); rowsEl.appendChild(th);
      var tb = el("tbody"); rowsEl.appendChild(tb);
      data.forEach(function (r, i) {
        var tr = el("tr"), refs = { r: r };
        tr.appendChild(el("td", "n", r.kind === "lat" ? "Lat" : String(i + 1)));
        if (r.kind === "star") { var td = el("td", "w-star"), sel = el("select"); sel.setAttribute("aria-label", "Star " + (i + 1)); var o0 = el("option", "", "choose a star"); o0.value = ""; sel.appendChild(o0); NAMES.forEach(function (n) { var o = el("option", "", n); o.value = n; sel.appendChild(o); }); sel.value = r.name || ""; sel.addEventListener("change", function () { r.name = sel.value; save(); render(); }); td.appendChild(sel); tr.appendChild(td); refs.sel = sel; }
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
          if (r.kind === "sun") { var tk = el("td", "w-limb"), sl = el("select"); sl.setAttribute("aria-label", "Limb"); LIMBS.forEach(function (x) { var o = el("option", "", x[1]); o.value = x[0]; sl.appendChild(o); }); sl.value = r.limb || "L"; sl.addEventListener("change", function () { r.limb = sl.value; save(); render(); }); tk.appendChild(sl); tr.appendChild(tk); refs.limb = sl; }
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
        if (r.kind === "star" && !r.name && !any && sec === null) return;
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
      var ready = !Object.keys(v.errs).length && v.lat !== null && v.lon !== null && v.course !== null && v.speed !== null && v.date && v.zone !== null && v.hoe !== null && rr.rows.length >= 2 && !rr.bad.length;
      var missing = [];
      if (v.lat === null || v.lon === null) missing.push("the DR position"); if (v.course === null || v.speed === null) missing.push("course and speed"); if (!v.date) missing.push("the date"); if (v.zone === null) missing.push("the time zone"); if (v.hoe === null) missing.push("height of eye (0 if none)"); if (rr.rows.length < 2) missing.push("at least two sights");
      if (!ready) { $("sf-out").hidden = true; $("sf-empty").hidden = false; $("sf-empty").textContent = missing.length && !rr.bad.length ? "Still needed: " + missing.join(", ") + "." : "Check the entries marked in red."; last = null; return; }
      var base = Date.UTC(v.date.y, v.date.m - 1, v.date.d), sights = rr.rows.map(function (s) { var o = { name: s.name, ms: base + (s.secLocal - v.zone * 3600) * 1000 + s.dayAdd * 1000 }; if (s.name === "Latitude") o.lat = s.lat; else { o.hs = s.hs; o.limb = s.limb; } return o; });
      var t1 = Math.min.apply(null, sights.map(function (s) { return s.ms; })), side = $("sf-ie-on").checked ? -1 : 1;
      var inp = { dr: { lat: v.lat * ($("sf-lat-s").checked ? -1 : 1), lon: v.lon * ($("sf-lon-w").checked ? -1 : 1), ms: t1, course: v.course, speed: v.speed }, hoe: v.hoe, ic: side * (v.ie || 0), temp: v.temp === null ? 10 : v.temp, pres: v.pres === null ? 1010 : v.pres, sights: sights };
      if (v.gps) inp.gps = v.gps;
      var r = SightFix.fix(inp);
      if (r.error) { $("sf-out").hidden = true; $("sf-empty").hidden = false; $("sf-empty").textContent = r.error; last = null; return; }
      last = { r: r, v: v, zone: v.zone, inp: inp }; show(r, v);
    }
    function localOf(ms, zone) { return hms(((ms + zone * 3600000) / 1000)); }
    function show(r, v) {
      $("sf-empty").hidden = true; $("sf-out").hidden = false;
      var w = $("sf-warn"); w.hidden = !r.warnings.length; w.textContent = r.warnings.join("\n");
      $("sf-f-lat").textContent = Geo.lat(r.fix.lat); $("sf-f-lon").textContent = Geo.lon(r.fix.lon);
      $("sf-f-time").textContent = "at " + localOf(r.time, v.zone) + " local"; $("sf-f-ut").textContent = utText(r.time) + " UT";
      $("sf-f-set").textContent = r.setDeg === null ? "on the DR" : Math.round(r.setDeg) + "° " + r.distNM.toFixed(1) + " NM";
      $("sf-f-set-sub").textContent = r.setDeg === null ? "no difference" : "the fix is this far, this way, from the DR" + (r.driftKn !== null ? " (" + r.driftKn.toFixed(1) + " kn over " + ((r.time - last_dr_ms(r)) / 3600000).toFixed(1) + " h)" : "");
      var q = "—", qs = "";
      if (r.cutDeg !== undefined) { q = "cut " + r.cutDeg + "°"; qs = r.cutDeg >= 60 ? "good" : r.cutDeg >= 30 ? "acceptable" : "weak"; }
      else if (r.hatNM !== undefined) { q = "hat " + r.hatNM.toFixed(1) + " NM"; qs = r.hatNM < 3 ? "small: good" : r.hatNM < 6 ? "moderate" : "large: check the sights"; }
      else if (r.residuals && r.residuals.length) { var mx = Math.max.apply(null, r.residuals.map(Math.abs)); q = "±" + mx.toFixed(1) + "'"; qs = "worst line miss"; }
      if (r.constErr !== undefined) qs += (qs ? "; " : "") + "constant error " + (r.constErr >= 0 ? "+" : "−") + Math.abs(r.constErr).toFixed(1) + "'";
      $("sf-f-q").textContent = q; $("sf-f-q-sub").textContent = qs;
      var tbl = $("sf-tbl"); while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var hh = el("tr"); ["Body", "Local time", "Hs", "Ho", "Hc", "Intercept", "Zn"].forEach(function (h) { hh.appendChild(el("th", "", h)); }); var th = el("thead"); th.appendChild(hh); tbl.appendChild(th); var tb = el("tbody"); tbl.appendChild(tb);
      r.sights.forEach(function (s, i) {
        var tr = el("tr"), hs = last_hs(i);
        tr.appendChild(el("td", "", s.name)); tr.appendChild(el("td", "", localOf(s.ms, v.zone)));
        if (s.name === "Latitude") { ["", "", "", Math.abs(s.a).toFixed(1) + " NM " + (s.a >= 0 ? "N" : "S"), "000°"].forEach(function (t) { tr.appendChild(el("td", "num", t)); }); }
        else [hs, alt(s.ho), alt(s.hc), Math.abs(s.a).toFixed(1) + " " + (s.a >= 0 ? "toward" : "away"), s.zn.toFixed(1) + "°"].forEach(function (t) { tr.appendChild(el("td", "num", t)); });
        tb.appendChild(tr);
      });
      var ft = r.fix; var line = (mode === "sun" ? "Running fix by Sun" : "Fix by stars") + " " + localOf(r.time, v.zone) + " LT (" + utText(r.time) + " UT): " + Geo.lat(ft.lat) + " " + Geo.lon(ft.lon) + (r.setDeg === null ? "" : " | " + Math.round(r.setDeg) + "° " + r.distNM.toFixed(1) + " NM from DR") + (r.gpsErrNM !== undefined ? " | GPS difference " + r.gpsErrNM.toFixed(1) + " NM" : "");
      $("sf-log").textContent = line;
      work(r, v);
    }
    function last_dr_ms(r) { return last.inp.dr.ms; }
    function last_hs(i) { var s = last.inp.sights[i]; return s.hs === undefined ? "" : alt(s.hs); }
    function work(r, v) {
      var tbl = $("sf-work-tbl"); while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var body = r.sights.filter(function (s) { return s.name !== "Latitude"; });
      var th = el("thead"), hr = el("tr"); hr.appendChild(el("th", "", "Step")); body.forEach(function (s) { hr.appendChild(el("th", "", s.name)); }); th.appendChild(hr); tbl.appendChild(th); var tb = el("tbody"); tbl.appendChild(tb);
      function row(label, f) { var tr = el("tr"); tr.appendChild(el("td", "", label)); body.forEach(function (s, i) { tr.appendChild(el("td", "num", f(s, i))); }); tb.appendChild(tr); }
      var idxOf = function (s) { return r.sights.indexOf(s); };
      row("UT", function (s) { return utText(s.ms); }); row("DR (assumed position)", function (s) { return Geo.lat(s.ap.lat) + " " + Geo.lon(s.ap.lon); });
      row("GHA (Sun) or GHA Aries + SHA (star)", function (s) { return alt(s.gha); }); row("Declination", function (s) { return (s.dec < 0 ? "S " : "N ") + alt(Math.abs(s.dec)); }); row("LHA", function (s) { return alt(s.lha); });
      row("Sextant altitude Hs", function (s) { return last_hs(idxOf(s)); });
      row("Index correction", function (s) { var ic = last.inp.ic; return (ic >= 0 ? "+" : "−") + Math.abs(ic).toFixed(1) + "'"; });
      row("Dip (height of eye)", function (s) { return "−" + s.corr.dip.toFixed(1) + "'"; }); row("Apparent altitude", function (s) { return alt(s.corr.ha); });
      row("Refraction", function (s) { return "−" + s.corr.ref.toFixed(1) + "'"; }); row("Semi-diameter", function (s) { return s.corr.sd === 0 ? "—" : (s.corr.sd > 0 ? "+" : "−") + Math.abs(s.corr.sd).toFixed(1) + "'"; }); row("Parallax", function (s) { return s.corr.par === 0 ? "—" : "+" + s.corr.par.toFixed(1) + "'"; });
      row("Observed altitude Ho", function (s) { return alt(s.ho); }); row("Calculated altitude Hc", function (s) { return alt(s.hc); }); row("Intercept (Ho − Hc)", function (s) { return Math.abs(s.a).toFixed(1) + "' " + (s.a >= 0 ? "toward" : "away"); }); row("Azimuth Zn", function (s) { return s.zn.toFixed(1) + "°"; });
    }

    /* ---------- saving and loading ---------- */
    function save() {
      var o = st; o.mode = mode; o.f = {}; FIELDS.forEach(function (id) { o.f[id] = $(id).value; }); o.r = RADIOS.filter(function (id) { return $(id).checked; });
      if (!o.ship) o.ship = {}; o.ship[shipKey()] = { hoe: $("sf-hoe").value, ie: $("sf-ie").value, off: $("sf-ie-off").checked };
      store.set(KEY, o);
    }
    function load() {
      if (st.f) FIELDS.forEach(function (id) { if (st.f[id] !== undefined) $(id).value = st.f[id]; });
      (st.r || []).forEach(function (id) { if ($(id)) $(id).checked = true; });
      shipFill();
      if (!$("sf-date").value) $("sf-date").value = todayISO();
      $("sf-mode-" + mode).checked = true;
    }
    function shipFill() { var sh = (st.ship && st.ship[shipKey()]) || { hoe: "", ie: "", off: false }; $("sf-hoe").value = sh.hoe; $("sf-ie").value = sh.ie; (sh.off ? $("sf-ie-off") : $("sf-ie-on")).checked = true; }

    /* ---------- the buttons ---------- */
    function pickStars() {
      var v = read(); if (v.lat === null || v.lon === null || !v.date || v.zone === null) return;
      var first = rowRefs.filter(function (rf) { return parseTimeEl(rf.time) !== null; })[0];
      var sec = first ? parseTimeEl(first.time) : null; if (sec === null) { toast("Type the time of the first sight, then pick."); return; }
      var ms = Date.UTC(v.date.y, v.date.m - 1, v.date.d) + (sec - v.zone * 3600) * 1000;
      var pick = Sight.suggest(ms, v.lat * ($("sf-lat-s").checked ? -1 : 1), v.lon * ($("sf-lon-w").checked ? -1 : 1), 4);
      if (!pick.length) { toast("No good stars are up at that time."); return; }
      var data = st.rows.stars; data.forEach(function (r, i) { r.name = pick[i] ? pick[i].name : ""; if (pick[i] && !r.time) r.time = hms(sec); });
      build(); save(); render(); toast("Best stars for that time: " + pick.map(function (p) { return p.name + " " + Math.round(p.hc) + "°/" + Math.round(p.zn) + "°"; }).join(", "));
    }
    function example() {
      var set = function (id, val) { $(id).value = val; };
      if (mode === "stars") {
        set("sf-lat-d", "21"); set("sf-lat-m", "22.2"); $("sf-lat-n").checked = true; set("sf-lon-d", "37"); set("sf-lon-m", "57.2"); $("sf-lon-e").checked = true; set("sf-course", "332"); set("sf-speed", "12.4"); set("sf-date", "2026-04-14"); set("sf-zone", "2"); set("sf-hoe", "29"); set("sf-ie", "0"); $("sf-ie-on").checked = true; set("sf-temp", "27"); set("sf-pres", "1010");
        st.rows = st.rows || {}; st.rows.stars = [["Fomalhaut", "04:48:00", "11", "30.6"], ["Spica", "04:48:33", "4", "36.8"], ["Schedar", "04:48:55", "19", "04.5"], ["", "", "", ""]].map(function (x) { return { kind: "star", name: x[0], time: x[1], hd: x[2], hm: x[3], limb: "L" }; });
      } else {
        set("sf-lat-d", "22"); set("sf-lat-m", "54.6"); $("sf-lat-n").checked = true; set("sf-lon-d", "94"); set("sf-lon-m", "25.3"); $("sf-lon-w").checked = true; set("sf-course", "332"); set("sf-speed", "12.4"); set("sf-date", "2021-05-06"); set("sf-zone", "-5"); set("sf-hoe", "29"); set("sf-ie", "0"); $("sf-ie-on").checked = true; set("sf-temp", "27"); set("sf-pres", "1010");
        st.rows = st.rows || {}; st.rows.sun = [["13:48:55", "79", "41.0"], ["17:06:55", "35", "15.0"]].map(function (x) { return { kind: "sun", name: "Sun", time: x[0], hd: x[1], hm: x[2], limb: "L" }; }).concat([{ kind: "lat", time: "", ld: "", lm: "", ns: "N" }]);
      }
      build(); save(); render(); toast("Example loaded (from the owner's old workbook)");
    }
    function clearSights() { st.rows[mode] = null; build(); save(); render(); }

    $("sf-form").addEventListener("input", function () { save(); render(); });
    $("sf-form").addEventListener("change", function () { save(); render(); });
    ["sf-mode-sun", "sf-mode-stars"].forEach(function (id) { $(id).addEventListener("change", function () { mode = $("sf-mode-stars").checked ? "stars" : "sun"; build(); save(); render(); }); });
    $("sf-pick").addEventListener("click", pickStars); $("sf-example").addEventListener("click", example); $("sf-clear").addEventListener("click", clearSights);
    $("sf-copy").addEventListener("click", function () { if (last) copyText($("sf-log").textContent); });
    Ships.onChange(function () { if (started["sight-fix"]) { shipFill(); render(); } });
    load(); build(); render();
  }

