  /* Tool: Sight Fix (running fix by the Sun, fix by 3 to 4 stars) */
  function initSightFix() {
    var KEY = "bridgeCalc.sightFix", st = store.get(KEY) || {}, mode = st.mode === "stars" ? "stars" : "sun", rowsEl = $("sf-rows"), rowRefs = [], last = null, shipEdited = false;
    var LIMBS = [["L", "Lower"], ["U", "Upper"]];
    var NAMES = Sight.names();
    var FIELDS = ["sf-starsat", "sf-fixat", "sf-lat-d", "sf-lat-m", "sf-lon-d", "sf-lon-m", "sf-course", "sf-speed", "sf-date", "sf-zone", "sf-hoe", "sf-ie", "sf-temp", "sf-pres", "sf-gps-lat-d", "sf-gps-lat-m", "sf-gps-lon-d", "sf-gps-lon-m"];
    var RADIOS = ["sf-ap-each", "sf-ap-first", "sf-lat-n", "sf-lat-s", "sf-lon-e", "sf-lon-w", "sf-ie-on", "sf-ie-off", "sf-gps-lat-n", "sf-gps-lat-s", "sf-gps-lon-e", "sf-gps-lon-w"];
    function shipKey() { var s = Ships.active(); return s ? s.id : "_"; }
    function p2(n) { return ("0" + n).slice(-2); }
    function hms(sec) { sec = ((Math.round(sec) % 86400) + 86400) % 86400; return p2(Math.floor(sec / 3600)) + ":" + p2(Math.floor(sec % 3600 / 60)) + ":" + p2(sec % 60); }
    function utText(ms) { var d = new Date(ms); return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + ":" + p2(d.getUTCSeconds()); }
    function alt(deg) { var s = deg < 0 ? "−" : "", a = Math.abs(deg), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 600) / 10; if (m >= 60) { d++; m = 0; } return s + d + "°" + (m < 10 ? "0" : "") + m.toFixed(1) + "'"; }
    function num(s) { s = String(s).trim().replace(",", "."); return /^\d+(\.\d*)?$|^\.\d+$/.test(s) ? parseFloat(s) : NaN; }
    /* a position typed any easy way: 2122.1N 03757.1E, 21 22.1N 037 57.1E, 21-22.1N 37-57.1E, or without N/S/E/W (the DR's hemispheres
       are used). One number with no space: the last two whole digits are minutes (2122.1 = 21 22.1). Falls back to Geo.parse. */
    function parsePos(text) {
      var s = String(text || "").toUpperCase().replace(/[°º˚′’‘`´'″”“"]/g, " ").replace(/(\d)-(?=\d)/g, "$1 ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
      if (!s) return { error: "empty" };
      function val(t, lon) {
        var k = t.trim().split(" ").filter(Boolean), d, m;
        if (!k.length || k.length > 3 || k.some(function (x) { return !/^\d+(\.\d+)?$/.test(x); })) return NaN;
        if (k.length > 1) { d = +k[0]; m = +k[1] + (k[2] ? +k[2] / 60 : 0); }
        else { var ip = k[0].split(".")[0]; if (ip.length >= (lon ? 4 : 3)) { d = Math.floor(+k[0] / 100); m = +k[0] - d * 100; } else { d = +k[0]; m = 0; } }
        if (m >= 60 || d > (lon ? 180 : 90)) return NaN;
        return d + m / 60;
      }
      var mm = /^([0-9. ]+?)\s*([NS])\s*([0-9. ]+?)\s*([EW])$/.exec(s), la, lo, ns, ew;
      if (mm) { la = val(mm[1], false); lo = val(mm[3], true); ns = mm[2]; ew = mm[4]; }
      else if (/^[0-9. ]+$/.test(s)) {                                                 /* no letters: two numbers, or degrees and minutes twice */
        var t = s.split(" "); ns = $("sf-lat-s").checked ? "S" : "N"; ew = $("sf-lon-w").checked ? "W" : "E";
        if (t.length === 2) { la = val(t[0], false); lo = val(t[1], true); } else if (t.length === 4) { la = val(t[0] + " " + t[1], false); lo = val(t[2] + " " + t[3], true); } else return { error: "need a latitude and a longitude" };
      }
      else { var g = Geo.parse(text); return g.error ? g : { lat: g.lat, lon: g.lon }; }
      if (isNaN(la) || isNaN(lo)) return { error: "degrees or minutes out of range" };
      return { lat: la * (ns === "S" ? -1 : 1), lon: lo * (ew === "W" ? -1 : 1) };
    }
    /* the body list: first what is good to take now (from the stars panel), then Sun, Moon and planets, then every star A to Z */
    var goodNow = [], AZ = NAMES.slice().sort();
    function fillBodies(sel, val) {                                                 /* short list (good now) unless this row asked for all */
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var o0 = el("option", "", "choose a body"); o0.value = ""; sel.appendChild(o0);
      var groups = [], shortList = goodNow.length && !sel.full, inGood = goodNow.some(function (b) { return b.name === val; });
      if (goodNow.length) groups.push(["Good now (altitude, bearing)", goodNow.map(function (b) { return [b.name, b.name + "   " + Math.round(b.hc) + "°  " + ("00" + Math.round(b.zn) % 360).slice(-3) + "°"]; })]);
      if (shortList) {
        if (val && !inGood) groups.push(["Chosen", [[val, val]]]);
        groups.push(["More", [["__all", "Show all stars, Sun, Moon and planets\u2026"]]]);
      } else {
        groups.push(["Sun, Moon and planets", ["Sun", "Moon"].concat(Sight.planets()).map(function (n) { return [n, n]; })]);
        groups.push(["All stars A to Z", AZ.map(function (n) { return [n, n]; })]);
      }
      groups.forEach(function (g) { var og = document.createElement("optgroup"); og.label = g[0]; g[1].forEach(function (x) { var o = el("option", "", x[1]); o.value = x[0]; og.appendChild(o); }); sel.appendChild(og); });
      sel.value = val;
    }
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

    /* ---------- the rows of sights ---------- */
    function blankRow(kind) { return kind === "lat" ? { time: "", ld: "", lm: "", ns: "N" } : { name: "", time: "", hd: "", hm: "", limb: "L" }; }
    function rowData() { if (!st.rows) st.rows = {}; var want = mode === "sun" ? ["sun", "sun", "lat"] : ["star", "star", "star", "star"]; var cur = st.rows[mode] || []; return want.map(function (k, i) { var r = cur[i] || blankRow(k === "lat" ? "lat" : "body"); r.kind = k; if (k === "sun") r.name = "Sun"; return r; }); }
    function build() {
      var data = rowData(); st.rows[mode] = data; rowRefs = [];
      while (rowsEl.firstChild) rowsEl.removeChild(rowsEl.firstChild);
      var th = el("thead"), hr = el("tr");
      (mode === "sun" ? ["", "Local time", "Sextant altitude", "", "Limb", "DR at this sight"] : ["", "Body", "Local time", "Sextant altitude", "", "Limb", "DR at this sight"]).forEach(function (h, i) { var c = el("th", "", h); if ((mode === "sun" && i === 2) || (mode === "stars" && i === 3)) c.colSpan = 2; if (h === "" && ((mode === "sun" && i === 3) || (mode === "stars" && i === 4))) return; hr.appendChild(c); });
      th.appendChild(hr); rowsEl.appendChild(th);
      var tb = el("tbody"); rowsEl.appendChild(tb);
      data.forEach(function (r, i) {
        var tr = el("tr"), refs = { r: r };
        tr.appendChild(el("td", "n", r.kind === "lat" ? "Lat" : String(i + 1)));
        if (r.kind === "star") { var td = el("td", "w-star"), sel = el("select"); sel.setAttribute("aria-label", "Star " + (i + 1)); fillBodies(sel, r.name || ""); sel.addEventListener("change", function () {
            if (sel.value === "__all") { sel.full = true; fillBodies(sel, r.name || ""); try { if (sel.showPicker) sel.showPicker(); } catch (e) {} toast("All bodies listed: open the list again to choose."); return; }
            r.name = sel.value; if (refs.limb) { var lm = r.name === "Moon" || r.name === "Sun"; refs.limb.hidden = !lm; refs.na.hidden = lm; } save(); render(); }); td.appendChild(sel); tr.appendChild(td); refs.sel = sel; }
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
        var tp = el("td", "w-dr");                                                     /* the officer's DR at this sight; empty: worked from the first DR, course and speed */
        if (r.kind === "lat") tp.appendChild(el("span", "small muted", "not needed"));
        else { var pi = el("input", "text-input"); pi.type = "text"; pi.maxLength = 40; pi.value = r.pos || ""; pi.placeholder = "e.g. 2122.1N 03757.1E"; pi.setAttribute("aria-label", "DR position at sight " + (i + 1)); pi.addEventListener("input", function () { r.pos = pi.value; save(); render(); });
          pi.addEventListener("blur", function () { var g = parsePos(pi.value); if (pi.value && !g.error) { pi.value = Geo.lat(g.lat) + " " + Geo.lon(g.lon); r.pos = pi.value; save(); render(); } });   /* tidy what was typed */ tp.appendChild(pi); refs.pos = pi; }
        tr.appendChild(tp);
        tb.appendChild(tr); rowRefs.push(refs);
      });
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
      setHint("sf-course-msg", errs.course || "", !!errs.course, $("sf-course")); setHint("sf-speed-msg", errs.speed || "", !!errs.speed, $("sf-speed")); setHint("sf-hoe-msg", errs.hoe || "", !!errs.hoe, $("sf-hoe")); setHint("sf-ie-msg", errs.ie || "On the arc is subtracted, off the arc is added", !!errs.ie, $("sf-ie"));
      setHint("sf-zone-msg", errs.zone || "+8 means ship's time = UTC + 8 (East +); nautical zone description is the opposite sign", !!errs.zone, $("sf-zone")); $("sf-temp").setAttribute("aria-invalid", errs.temp ? "true" : "false"); $("sf-pres").setAttribute("aria-invalid", errs.pres ? "true" : "false");
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
        var item = { name: name, secLocal: sec, dayAdd: add, rf: rf };
        if (r.kind !== "lat" && r.pos && String(r.pos).trim()) { var gp = parsePos(r.pos); if (gp.error || Math.abs(gp.lat) > 84) { bad.push("Row " + (i + 1) + ": DR position not understood (" + (gp.error || "latitude above 84") + "). For example 2122.1N 03757.1E or 21 22.1N 037 57.1E."); return; } item.dr = { lat: gp.lat, lon: gp.lon }; }
        if (r.kind === "lat") item.lat = val; else { item.hs = val; item.limb = r.limb || "L"; }
        out.push(item);
      });
      return { rows: out, bad: bad };
    }

    function render() {
      var v = read(), rr = readRows(v), msg = $("sf-rows-msg"); starPanel();
      msg.textContent = rr.bad.join(" "); msg.className = rr.bad.length ? "hint error" : "hint";
      var one = rr.rows.length === 1 && rr.rows[0].name !== "Latitude";
      var ready = !Object.keys(v.errs).length && v.lat !== null && v.lon !== null && (one || (v.course !== null && v.speed !== null)) && v.date && v.zone !== null && v.hoe !== null && (one || rr.rows.length >= 2) && !rr.bad.length;
      var missing = [];
      if (v.lat === null || v.lon === null) missing.push("the DR position"); if (!one && (v.course === null || v.speed === null)) missing.push("course and speed"); if (!v.date) missing.push("the date"); if (v.zone === null) missing.push("the time zone"); if (v.hoe === null) missing.push("height of eye (metres, the eye above the sea)"); if (!rr.rows.length) missing.push("a sight (one sight gives a position line, two or more give a fix)"); else if (!one && rr.rows.length < 2) missing.push("a second sight");
      if (!ready) { $("sf-out").hidden = true; $("sf-sheet").classList.add("no-print"); $("sf-empty").hidden = false; $("sf-empty").className = "empty"; $("sf-empty").textContent = missing.length && !rr.bad.length ? "Still needed: " + missing.join(", ") + ". The fix, the working and the diagram appear as soon as these are in." : "Check the entries marked in red."; last = null; return; }
      var base = Date.UTC(v.date.y, v.date.m - 1, v.date.d), sights = rr.rows.map(function (s) { var o = { name: s.name, ms: base + (s.secLocal - v.zone * 3600) * 1000 + s.dayAdd * 1000 }; if (s.dr) o.dr = s.dr; if (s.name === "Latitude") o.lat = s.lat; else { o.hs = s.hs; o.limb = s.limb; } return o; });
      var t1 = Math.min.apply(null, sights.map(function (s) { return s.ms; })), side = $("sf-ie-on").checked ? -1 : 1, fa = parseTimeEl($("sf-fixat")), fixMs = null;
      if (fa !== null && sights.length > 1) {                                          /* that ship's clock time nearest the last sight */
        var tl = Math.max.apply(null, sights.map(function (s) { return s.ms; })); fixMs = base + (fa - v.zone * 3600) * 1000;
        fixMs += Math.round((tl - fixMs) / 86400000) * 86400000;
      }
      var inp = { dr: { lat: v.lat * ($("sf-lat-s").checked ? -1 : 1), lon: v.lon * ($("sf-lon-w").checked ? -1 : 1), ms: t1, course: v.course === null ? 0 : v.course, speed: v.speed === null ? 0 : v.speed }, hoe: v.hoe, ic: side * (v.ie || 0), temp: v.temp === null ? 10 : v.temp, pres: v.pres === null ? 1010 : v.pres, sights: sights };
      if (v.gps) inp.gps = v.gps;
      if ($("sf-ap-first").checked) inp.apMode = "first";
      if (fixMs !== null) inp.fixMs = fixMs;
      rr.rows.forEach(function (s, k) { if (s.rf.pos) { var q = SightFix.drAt(inp.dr, sights[k].ms); s.rf.pos.placeholder = Geo.lat(q.lat) + " " + Geo.lon(q.lon); } });     /* show the worked DR in grey */
      if (one && sights[0].dr) { inp.dr.lat = sights[0].dr.lat; inp.dr.lon = sights[0].dr.lon; }
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
      var rn = $("sf-runnote"), d0 = last.inp.dr, bodies = r.sights.filter(function (s) { return s.name !== "Latitude"; });
      rn.hidden = !(d0.speed > 0 && r.sights.length > 1);
      if (!rn.hidden) rn.textContent = "Ship under way at " + d0.speed + " kn on " + ("00" + Math.round(d0.course)).slice(-3) + "°: the ship was in a different place at each sight. " +
        bodies.map(function (s) { return s.name + " " + localOf(s.ms, v.zone) + " at " + Geo.lat(s.drSight.lat) + " " + Geo.lon(s.drSight.lon); }).join("; ") +
        ". Each line is carried forward along the course to " + localOf(r.time, v.zone).slice(0, 5) + ", where they cross: that is the fix.";
      var ft = r.fix, line = (methodText(r) + apNote()) + " " + localOf(r.time, v.zone) + " LT (" + utText(r.time) + " UT): " + Geo.lat(ft.lat) + " " + Geo.lon(ft.lon) + (r.setDeg === null ? "" : " | " + Math.round(r.setDeg) + "° " + r.distNM.toFixed(1) + " NM from DR") + (r.gpsErrNM !== undefined ? " | GPS difference " + r.gpsErrNM.toFixed(1) + " NM" : "");
      $("sf-log").textContent = line;
      work($("sf-work-tbl"), r, v); sheet(r, v);
    }
    var LEG_FIX = $("sf-legend").textContent;
    function labels(t) { ["sf-l1", "sf-l2", "sf-l3", "sf-l4"].forEach(function (id, i) { $(id).textContent = t[i]; }); }
    function showLine(r, v) {                                                      /* one sight: position line and longitude by chronometer */
      $("sf-sheet").classList.remove("no-print"); $("sf-empty").hidden = true; $("sf-out").hidden = false;
      var s = r.sights[0], w = $("sf-warn"); w.hidden = !r.warnings.length; w.textContent = r.warnings.join("\n");
      var byLat = r.lonChron === null && r.latChron !== undefined;
      labels(["Intercept", "Azimuth Zn", byLat ? (r.sights[0].name === "Polaris" ? "Latitude by Pole Star" : "Latitude (meridian / ex-meridian)") : "Longitude by chronometer", "Position line"]);
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
    function apNote() { return last && last.inp.apMode === "first" ? " (every sight worked from the first DR)" : ""; }
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
        ["Index error", (ic === 0 ? "nil" : Math.abs(ic).toFixed(1) + "' " + (ic < 0 ? "on" : "off") + " the arc")], ["Temp / pressure", i.temp + " °C / " + i.pres + " hPa"], ["Method", (methodText(r) + apNote()), 2]]);
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
      row("UT", function (s) { return utText(s.ms); }); row(last.inp.apMode === "first" ? "Assumed position (the first DR)" : "Assumed position (DR at the sight)", function (s) { return Geo.lat(s.ap.lat) + " " + Geo.lon(s.ap.lon); });
      row("GHA", function (s) { return alt(s.gha); }); row("Declination", function (s) { return (s.dec < 0 ? "S " : "N ") + alt(Math.abs(s.dec)); }); row("LHA", function (s) { return alt(dsp(s).lha); });
      row("Sextant altitude Hs", function (s) { return last_hs(idxOf(s)); });
      row("Index correction", function (s) { var ic = last.inp.ic; return (ic >= 0 ? "+" : "−") + Math.abs(ic).toFixed(1) + "'"; });
      row("Dip (height of eye)", function (s) { return "−" + s.corr.dip.toFixed(1) + "'"; }); row("Apparent altitude", function (s) { return alt(s.corr.ha); });
      row("Refraction", function (s) { return "−" + s.corr.ref.toFixed(1) + "'"; }); row("Semi-diameter", function (s) { return s.corr.sd === 0 ? "—" : (s.corr.sd > 0 ? "+" : "−") + Math.abs(s.corr.sd).toFixed(1) + "'"; }); row("Parallax in altitude", function (s) { return s.kind === "moon" ? "+" + s.pa.toFixed(1) + "' (HP " + s.hp.toFixed(1) + "')" : s.corr.par === 0 ? "—" : "+" + s.corr.par.toFixed(1) + "'"; });
      row("True altitude Ho", function (s) { return alt(dsp(s).ho); }); row("Calculated altitude Hc", function (s) { return alt(dsp(s).hc); }); row("Intercept (Ho − Hc)", function (s) { return Math.abs(s.a).toFixed(1) + "' " + (s.a >= 0 ? "toward" : "away"); }); row("Azimuth Zn", function (s) { return s.zn.toFixed(1) + "°"; });
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
    /* ---------- the stars and planets panel ---------- */
    var PMAG = { Venus: -4, Jupiter: -2.2, Mars: 0.5, Saturn: 0.7, Moon: -10, Sun: -26 };
    function starCtx() {                                                              /* DR, date, zone and the time to look at, or null */
      var v = read(); if (v.lat === null || v.lon === null || v.errs.lat || v.errs.lon || !v.date || v.zone === null) return null;
      var sec = parseTimeEl($("sf-starsat")); if (sec === null) { var f = rowRefs.filter(function (rf) { return parseTimeEl(rf.time) !== null; })[0]; sec = f ? parseTimeEl(f.time) : null; }
      return { v: v, sec: sec, lat: v.lat * ($("sf-lat-s").checked ? -1 : 1), lon: v.lon * ($("sf-lon-w").checked ? -1 : 1), base: Date.UTC(v.date.y, v.date.m - 1, v.date.d) };
    }
    function verdict(b) {                                                            /* GOOD: 20-60 deg and bright; OK: 15-20 or 60-70 or fainter */
      var bright = b.mag <= 2.0;
      if (b.hc >= 20 && b.hc <= 60 && bright) return ["take", "GOOD"];
      if (b.hc >= 15 && b.hc <= 70 && b.mag <= 2.6) return ["ok", "OK"];
      return null;
    }
    function starPanel() {
      var tbl = $("sf-startbl"), note = $("sf-starnote"), c = starCtx(); while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      $("sf-starbox").hidden = mode !== "stars";
      function noGood() { if (goodNow.length) { goodNow = []; starPanel.last = ""; rowRefs.forEach(function (rf) { if (rf.sel) fillBodies(rf.sel, rf.r.name || ""); }); } }
      if (!c) { noGood(); note.textContent = "Enter the DR position, date and zone, then choose a time or press a twilight button."; return; }
      if (c.sec === null) { noGood(); note.textContent = "Choose the time you will take the sights, or press Morning twilight or Evening twilight."; return; }
      var ms = c.base + (c.sec - c.v.zone * 3600) * 1000, fr = Sight.frame(ms), list = [];
      Sight.bodiesAt(ms, c.lat, c.lon).forEach(function (b) { b.mag = b.name === "Sun" ? -26 : Sight.mag(b.name); b.kind = b.name === "Sun" ? "Sun" : "star"; list.push(b); });
      ["Moon"].concat(Sight.planets()).forEach(function (nm) { var r = Sight.reduceBody(Sight.place(ms, nm, fr), c.lat, c.lon); list.push({ name: nm, hc: r.hc, zn: r.zn, mag: PMAG[nm], kind: nm === "Moon" ? "Moon" : "planet" }); });
      var sun = list.filter(function (b) { return b.name === "Sun"; })[0], sh = sun.hc;
      var light = sh > -1 ? "The Sun is up: only the Moon and Venus can be seen." : sh > -3 ? "Too light yet: only planets and the brightest stars." : sh >= -12 ? "Good light: horizon and stars both visible." : "Dark: the horizon may be hard to see.";
      note.textContent = "At " + hms(c.sec).slice(0, 5) + " ship's time the Sun is " + (sh < 0 ? "−" : "") + Math.abs(sh).toFixed(1) + "°. " + light + " Tap a star to put it in the next empty row (altitude · bearing · brightness). GOOD: 20° to 60° high and bright.";
      var shown = list.filter(function (b) { return b.name !== "Sun" && verdict(b) && (sh <= -3 || b.mag <= 0); }).sort(function (a, b) { return a.zn - b.zn; });
      if (sh > -1 && sun.hc > 10) shown.unshift({ name: "Sun", hc: sun.hc, zn: sun.zn, mag: -26, kind: "Sun" });
      var good = shown.filter(function (b) { return (verdict(b) || [])[1] === "GOOD" || (b.kind !== "star" && b.hc >= 20 && b.hc <= 60); }), more = shown.filter(function (b) { return good.indexOf(b) < 0; });
      function chip(b, parent) {
        var bt = el("button", "sf-chip " + (verdict(b) || ["ok"])[0]); bt.type = "button";
        bt.appendChild(el("strong", "", b.name)); bt.appendChild(el("span", "", Math.round(b.hc) + "° · " + ("00" + Math.round(b.zn) % 360).slice(-3) + "°" + (b.kind === "star" ? " · mag " + b.mag.toFixed(1) : " · " + b.kind.toLowerCase())));
        bt.setAttribute("aria-label", "Use " + b.name + ", altitude " + Math.round(b.hc) + " degrees, bearing " + Math.round(b.zn)); bt.addEventListener("click", function () { useBody(b.name); }); parent.appendChild(bt);
      }
      var box = el("div", "sf-chips"); good.forEach(function (b) { chip(b, box); }); tbl.appendChild(box);
      var gs = good.map(function (b) { return b.name + Math.round(b.hc) + "/" + Math.round(b.zn); }).join(",");
      if (gs !== starPanel.last) { starPanel.last = gs; goodNow = good.slice(); rowRefs.forEach(function (rf) { if (rf.sel) fillBodies(rf.sel, rf.r.name || ""); }); }
      if (!good.length) tbl.appendChild(el("p", "small muted", "Nothing GOOD at this time" + (more.length ? "; see the OK ones below." : ".")));
      if (more.length) { var dt = el("details", "sf-more"), sm = el("summary", "", "Also possible (OK, lower, higher or fainter): " + more.length); dt.appendChild(sm); var b2 = el("div", "sf-chips"); more.forEach(function (b) { chip(b, b2); }); dt.appendChild(b2); tbl.appendChild(dt); }
    }
    function useBody(name) {
      var data = st.rows.stars || [], free = data.filter(function (r) { return !r.name && !r.hd && !r.hm; })[0] || data.filter(function (r) { return !r.hd && !r.hm && !r.time; })[0];
      if (!free) { toast("All rows have sights. Clear one first."); return; }
      if (data.some(function (r) { return r.name === name; })) { toast(name + " is already in the list."); return; }
      free.name = name; build(); save(); render(); toast(name + " put in row " + (data.indexOf(free) + 1) + ". Type its time and sextant altitude.");
    }
    function pickStars() {
      var c = starCtx(); if (!c || c.sec === null) { toast("Choose the time first, or press a twilight button."); return; }
      var pick = Sight.suggest(c.base + (c.sec - c.v.zone * 3600) * 1000, c.lat, c.lon, 4);
      if (!pick.length) { toast("No good stars are up at that time."); return; }
      var n = 0; (st.rows.stars || []).forEach(function (r) { if (r.hd || r.hm) return; var p = pick[n++]; r.name = p ? p.name : ""; });
      build(); save(); render(); toast("Best 4, well spread round the horizon: " + pick.map(function (p) { return p.name + " " + Math.round(p.hc) + "°/" + ("00" + Math.round(p.zn)).slice(-3) + "°"; }).join(", "));
    }
    function twilight(am) {
      var c = starCtx(); if (!c) { toast("Enter the DR position, date and zone first."); return; }
      var R = SunTimes.solve(c.v.date.y, c.v.date.m, c.v.date.d, c.v.zone, c.lat, c.lon, 0), n = R.levels.nautical, cv = R.levels.civil;
      var a = am ? n.rise[0] : n.set[0], b = am ? cv.rise[0] : cv.set[0];
      if (a === undefined || b === undefined) { toast("No twilight at this place and date."); return; }
      var t = (a + b) / 2, sec = Math.round(((t + c.v.zone * 3600000) / 1000) % 86400 + 86400) % 86400;   /* halfway between nautical and civil twilight: the usual star time */
      $("sf-starsat").value = hms(sec).slice(0, 5); save(); render();
    }
    /* Examples, one per method. Sights are made from a known true track (ship 060 deg 14 kn, Gulf of Mexico, zone -6); the DR is 3' S and
       4' E of the truth, so the intercepts are real. Height of eye 25 m, index error 1.2' off the arc, 27 C, 1010 hPa. Every box is filled. */
    var EX = { lat: 22.9, lon: -90.4, course: 60, speed: 14, zone: -6, hoe: 25, ie: 1.2, temp: 27, pres: 1010 };
    function exampleSights(m) {
      var day = m === "day" ? Date.UTC(2026, 0, 10) : Date.UTC(2026, 0, 15), loc = function (hh, mm, ss) { return day + ((hh - EX.zone) * 3600 + mm * 60 + (ss || 0)) * 1000; };
      var t0, plan = [];                                                               /* [name, UT ms, limb] */
      function merPass(tGuess) { var t = tGuess; for (var k = 0; k < 6; k++) { var q = truth(t), p = Sight.sunPlace(t), lha = ((p.gha + q.lon) % 360 + 540) % 360 - 180; t -= lha / 15 * 3600000; } return Math.round(t / 1000) * 1000; }   /* Sun on the ship's meridian */
      var dr0 = { lat: EX.lat, lon: EX.lon, ms: loc(8, 40), course: EX.course, speed: EX.speed };
      function truth(t) { var d = SightFix.drAt(dr0, t); return SightFix.move(d, 3, -4); }          /* the ship is really 3' N and 4' W of the DR */
      if (m === "noon") { plan = [["Sun", loc(8, 40, 12), "L"]]; plan.push(["Sun", merPass(loc(12, 0)), "L"]); }
      else if (m === "sunrun") plan = [["Sun", loc(8, 40, 12), "L"], ["Sun", loc(14, 5, 30), "L"]];
      else if (m === "one") plan = [["Sun", loc(9, 12, 40), "L"]];
      else if (m === "mer") plan = [["Sun", merPass(loc(12, 0)), "L"]];
      else if (m === "day") plan = [["Sun", loc(9, 0, 20), "L"], ["Moon", loc(9, 4, 45), "L"]];
      else {                                                                           /* twilight: Polaris, or the best 4 stars 6 minutes apart */
        var R = SunTimes.solve(2026, 1, 15, EX.zone, EX.lat, EX.lon, 0), tw = Math.round((R.levels.nautical.rise[0] + R.levels.civil.rise[0]) / 2 / 60000) * 60000;
        if (m === "polaris") plan = [["Polaris", tw + 20000, "L"]];
        else { var best = Sight.suggest(tw, EX.lat, EX.lon, 4); best.forEach(function (b, k) { plan.push([b.name, tw - 9 * 60000 + k * 6 * 60000 + (k * 7 % 50) * 1000, "L"]); }); }
      }
      t0 = plan.reduce(function (a, b) { return Math.min(a, b[1]); }, Infinity); dr0.ms = t0;
      return { day: day, dr: dr0, sights: plan.map(function (p) {
        var ms = p[1], q = truth(ms), pl = Sight.place(ms, p[0]), r = Sight.reduceBody(pl, q.lat, q.lon), hs = r.hc, k;
        for (k = 0; k < 20; k++) { var c = Sight.ho({ hs: hs, ic: EX.ie, hoe: EX.hoe, temp: EX.temp, pres: EX.pres, body: pl.kind, limb: p[2], sd: pl.kind === "moon" ? r.sd : pl.sd, hp: pl.hp }); hs += r.hc - c.ho; }
        var hm = Math.round(hs * 600) / 10, d = Math.floor(hm / 60), mi = hm - d * 60, dp = SightFix.drAt(dr0, ms);
        return { name: p[0], time: hms(((ms + EX.zone * 3600000) / 1000)), hd: String(d), hm: (mi < 10 ? "0" : "") + mi.toFixed(1), limb: p[2], pos: Geo.lat(dp.lat) + " " + Geo.lon(dp.lon) };
      }) };
    }
    function example() {
      var m = st.method || (mode === "sun" ? "noon" : "stars"), X = exampleSights(m), set = function (id, val) { $(id).value = val; }, key = shipKey(), prior = st.ship && st.ship[key] ? JSON.parse(JSON.stringify(st.ship[key])) : null;
      var la = Math.abs(X.dr.lat), lo = Math.abs(X.dr.lon), dd = new Date(X.day);
      set("sf-lat-d", String(Math.floor(la))); set("sf-lat-m", ((la - Math.floor(la)) * 60).toFixed(1)); (X.dr.lat < 0 ? $("sf-lat-s") : $("sf-lat-n")).checked = true;
      set("sf-lon-d", String(Math.floor(lo))); set("sf-lon-m", ((lo - Math.floor(lo)) * 60).toFixed(1)); (X.dr.lon < 0 ? $("sf-lon-w") : $("sf-lon-e")).checked = true;
      set("sf-course", ("00" + EX.course).slice(-3)); set("sf-speed", String(EX.speed)); set("sf-date", dd.getUTCFullYear() + "-" + p2(dd.getUTCMonth() + 1) + "-" + p2(dd.getUTCDate())); set("sf-zone", String(EX.zone));
      set("sf-hoe", String(EX.hoe)); set("sf-ie", String(EX.ie)); $("sf-ie-off").checked = true; set("sf-temp", String(EX.temp)); set("sf-pres", String(EX.pres));
      set("sf-fixat", m === "noon" ? "12:00" : ""); st.fixAuto = m === "noon"; set("sf-starsat", m === "stars" || m === "polaris" ? X.sights[0].time.slice(0, 5) : "");
      st.rows = st.rows || {};
      if (mode === "sun") st.rows.sun = X.sights.map(function (s) { return { kind: "sun", name: "Sun", time: s.time, hd: s.hd, hm: s.hm, limb: s.limb, pos: s.pos }; }).concat(X.sights.length < 2 ? [{ kind: "sun", name: "Sun", time: "", hd: "", hm: "", limb: "L" }] : []).concat([{ kind: "lat", time: "", ld: "", lm: "", ns: "N" }]);
      else { var rows = X.sights.map(function (s) { return { kind: "star", name: s.name, time: s.time, hd: s.hd, hm: s.hm, limb: s.limb, pos: s.pos }; }); while (rows.length < 4) rows.push({ kind: "star", name: "", time: "", hd: "", hm: "", limb: "L" }); st.rows.stars = rows; }
      shipEdited = false; build(); save(); if (st.ship) { if (prior) st.ship[key] = prior; else delete st.ship[key]; store.set(KEY, st); } render();
      toast("Example: sights made from a known true position (the ship was 3' N and 4' W of her DR). Every box is filled, so you can see what goes where.");
    }
    function clearSights() { st.rows[mode] = null; build(); save(); render(); }

    $("sf-form").addEventListener("input", function () { save(); render(); });
    $("sf-form").addEventListener("change", function () { save(); render(); });
    ["sf-mode-sun", "sf-mode-stars"].forEach(function (id) { $(id).addEventListener("change", function () { mode = $("sf-mode-stars").checked ? "stars" : "sun"; build(); setMethod(mode === "stars" ? "stars" : "noon", false); }); });   /* keeps the method buttons in step */
    $("sf-fixat").addEventListener("input", function () { st.fixAuto = false; save(); render(); }); $("sf-fixat").addEventListener("change", function () { save(); render(); });
    ["sf-hoe", "sf-ie"].forEach(function (id) { $(id).addEventListener("input", function () { shipEdited = true; }); }); ["sf-ie-on", "sf-ie-off"].forEach(function (id) { $(id).addEventListener("change", function () { shipEdited = true; }); });
    ["sf-ap-each", "sf-ap-first"].forEach(function (id) { $(id).addEventListener("change", function () { save(); render(); }); });
    /* ---------- the method picker: sets the mode and the bodies, never wipes what was typed ---------- */
    var METHODS = {
      noon: ["sun", "Morning Sun sight (about 0800 to 0900) as row 1, the Sun at meridian passage (noon) as row 2. Gives the noon position (Subramaniam ch. 26). Type 12:00 in \u201cGive the fix at\u201d for the position at noon by the ship's clock. Use the course and speed made good between the sights."],
      sunrun: ["sun", "Two Sun sights at least 2 to 3 hours apart, so the bearing changes 30\u00b0 or more. The first line is carried forward by your course and speed to the second sight: use the course and speed made good (allowing for current, if known)."],
      one: ["stars", "One sight of any body, away from the meridian (Sun mid-morning or afternoon, a star, planet or the Moon). Gives the intercept, the position line through the ITP and the longitude where it crosses your DR latitude (longitude by chronometer)."],
      mer: ["stars", "One sight of any body on or near the meridian (bearing within 30\u00b0 of north or south): the Sun at noon, a star, a planet or the Moon, above or below the pole. Gives your latitude where the line crosses your DR longitude. Use the time of the sight. For the Sun alone the Meridian Passage page also works."],
      polaris: ["stars", "One sight of Polaris at twilight (northern hemisphere, so the horizon and the star are both visible). Gives your latitude directly; no Pole Star tables needed."],
      stars: ["stars", "3 or 4 stars at twilight, spread round the horizon. In \u201cStars and planets you can take\u201d press Morning or Evening twilight, then Use the best 4 (or tap the stars you want). Then type each star's time, sextant altitude and your DR at that moment."],
      day: ["stars", "By day when the Moon or Venus is visible: one Sun sight and one Moon (or Venus) sight close in time give a fix. Choose the limb for the Sun and the Moon."]
    };
    function setMethod(m, fromUser) {
      if (!METHODS[m]) m = mode === "sun" ? "noon" : "stars";
      st.method = m; var want = METHODS[m][0];
      if (want !== mode) { $("sf-mode-" + want).checked = true; mode = want; build(); }
      if (fromUser) {
        var rows = st.rows[mode] || [], empty = function (r) { return r && !r.time && !r.hd && !r.hm; };     /* only rows with nothing typed are given a body */
        if (m === "polaris" && empty(rows[0])) rows[0].name = "Polaris";
        if (m === "day") { if (empty(rows[0])) rows[0].name = "Sun"; if (empty(rows[1])) rows[1].name = "Moon"; }
        if (m === "noon" && !$("sf-fixat").value) { $("sf-fixat").value = "12:00"; st.fixAuto = true; }
        if (m !== "noon" && st.fixAuto && $("sf-fixat").value === "12:00") { $("sf-fixat").value = ""; st.fixAuto = false; }     /* the noon time does not belong to other methods */
        build();
      }
      [].forEach.call(document.querySelectorAll("#sf-methods [data-m]"), function (b) { var on = b.getAttribute("data-m") === m; b.className = on ? "btn primary" : "btn"; b.setAttribute("aria-pressed", on ? "true" : "false"); });
      $("sf-method-help").textContent = METHODS[m][1];
      save(); render();
    }
    [].forEach.call(document.querySelectorAll("#sf-methods [data-m]"), function (b) { b.addEventListener("click", function () { setMethod(b.getAttribute("data-m"), true); }); });
    $("sf-filldr").addEventListener("click", function () {              /* write the worked DR positions into the empty boxes, to check or change them */
      var n = 0; rowRefs.forEach(function (rf) { if (rf.pos && !rf.pos.value && /[NS]/.test(rf.pos.placeholder) && parseTimeEl(rf.time) !== null) { rf.pos.value = rf.pos.placeholder; rf.r.pos = rf.pos.value; n++; } });
      save(); render(); toast(n ? "DR positions filled in from course and speed: check or change them" : "Enter the DR, course, speed and the sight times first");
    });
    $("sf-best4").addEventListener("click", pickStars);
    $("sf-tw-am").addEventListener("click", function () { twilight(true); }); $("sf-tw-pm").addEventListener("click", function () { twilight(false); });
    $("sf-starsat").addEventListener("input", function () { save(); starPanel(); }); $("sf-example").addEventListener("click", example); $("sf-clear").addEventListener("click", clearSights);
    $("sf-print").addEventListener("click", function () { if (last) window.print(); });
    $("sf-copy").addEventListener("click", function () { if (last) copyText($("sf-log").textContent); });
    Ships.onChange(function () { if (started["sight-fix"]) { shipFill(); render(); } });
    load(); build(); setMethod(st.method, false);
  }
  /* SIGHTPAGE-END */
