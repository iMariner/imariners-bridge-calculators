  function initSunTimes() {
    var KEY = "bridgeCalc.sun", WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], last = null;
    var latD = $("su-lat-d"), latM = $("su-lat-m"), lonD = $("su-lon-d"), lonM = $("su-lon-m");
    var ids = ["su-date", "su-zone", "su-lat-d", "su-lat-m", "su-lon-d", "su-lon-m", "su-hoe", "su-course", "su-speed", "su-postime"];

    function read() {
      var errs = {}, v = {};
      v.date = parseDateEl($("su-date"));
      v.zone = parseNum($("su-zone"));
      if (isNaN(v.zone) || (v.zone !== null && (v.zone < -14 || v.zone > 14))) errs.zone = "Enter -14 to +14 hours";
      v.lat = readDM("su-lat", 90, "Latitude", errs, "lat");
      v.lon = readDM("su-lon", 180, "Longitude", errs, "lon");
      v.hoe = parseNum($("su-hoe"));
      if (isNaN(v.hoe) || (v.hoe !== null && (v.hoe < 0 || v.hoe > 80))) errs.hoe = "Enter 0 to 80 m";
      setHint("su-zone-msg", errs.zone || "+8 means ship's time = UTC + 8 h (East +)", !!errs.zone, $("su-zone"));
      setHint("su-lat-msg", errs.lat || "0 – 90°", !!errs.lat);
      setHint("su-lon-msg", errs.lon || "0 – 180°", !!errs.lon);
      setHint("su-hoe-msg", errs.hoe || "0 = sea level, as in the Nautical Almanac. From the bridge the Sun shows a minute or so earlier.", !!errs.hoe, $("su-hoe"));
      v.course = parseNum($("su-course")); v.speed = parseNum($("su-speed")); v.postime = parseTimeEl($("su-postime"));
      if (isNaN(v.course) || (v.course !== null && (v.course < 0 || v.course > 360))) errs.course = "Course 0 to 360";
      if (isNaN(v.speed) || (v.speed !== null && (v.speed < 0 || v.speed > 40))) errs.speed = "Speed 0 to 40 kn";
      if (v.speed > 0 && v.course === null) errs.course = "Enter the course too";
      $("su-course").setAttribute("aria-invalid", errs.course ? "true" : "false"); $("su-speed").setAttribute("aria-invalid", errs.speed ? "true" : "false");
      setHint("su-mv-msg", errs.course || errs.speed || "Leave the speed empty for a ship at anchor. Under way, every time is worked at the ship's position at that moment.", !!(errs.course || errs.speed));
      var ok = !Object.keys(errs).length && v.date && v.zone !== null && v.lat !== null && v.lon !== null;
      if (ok) { v.latS = v.lat * ($("su-lat-s").checked ? -1 : 1); v.lonE = v.lon * ($("su-lon-w").checked ? -1 : 1); v.hoe = v.hoe || 0; }
      return ok ? v : null;
    }
    function save() {
      store.set(KEY, { date: gv("su-date"), zone: gv("su-zone"), latD: latD.value, latM: latM.value, south: $("su-lat-s").checked, lonD: lonD.value, lonM: lonM.value, west: $("su-lon-w").checked, hoe: gv("su-hoe"), course: gv("su-course"), speed: gv("su-speed"), postime: gv("su-postime") });
    }
    function load(o) {
      if (!o) return;
      $("su-date").value = o.date || ""; $("su-zone").value = o.zone || ""; latD.value = o.latD || ""; latM.value = o.latM || "";
      (o.south ? $("su-lat-s") : $("su-lat-n")).checked = true; lonD.value = o.lonD || ""; lonM.value = o.lonM || ""; (o.west ? $("su-lon-w") : $("su-lon-e")).checked = true; $("su-hoe").value = o.hoe || "";
      $("su-course").value = o.course || ""; $("su-speed").value = o.speed || ""; $("su-postime").value = o.postime || "";
    }

    /* time text: HH:MM to the nearest minute, with a day marker when the date differs from the ship's date */
    function frame(ms, offH, base) {
      var r = Math.round((ms + offH * 3600000) / 60000) * 60000, d = new Date(r), day = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - base) / 86400000);
      return TIME.p2(d.getUTCHours()) + ":" + TIME.p2(d.getUTCMinutes()) + (day ? " (" + (day > 0 ? "+" : "−") + Math.abs(day) + "d)" : "");
    }
    function zoneTxt(z) { return "UTC" + (z >= 0 ? "+" : "−") + Math.abs(z); }
    function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + " h " + TIME.p2(m % 60) + " m"; }

    function build(v) {
      var base = Date.UTC(v.date.y, v.date.m - 1, v.date.d), mv = v.speed > 0 ? { course: v.course, speed: v.speed, ms: base + ((v.postime === null ? 43200 : v.postime) - v.zone * 3600) * 1000 } : null;
      var R = SunTimes.solve(v.date.y, v.date.m, v.date.d, v.zone, v.latS, v.lonE, v.hoe, mv), L = R.levels;
      var rows = [], lonH = v.lonE / 15;
      function evt(name, ms, note, key) { if (mv) { var q = R.P(ms); note = (note ? note + " · " : "") + "at " + ns(q.lat) + " " + dm(Math.abs(q.lat)) + " " + ew(q.lon) + " " + dm(Math.abs(q.lon)); } rows.push({ name: name, ms: ms, note: note || "", key: !!key }); }
      function pair(level, nameUp, nameDown, noteNone) {
        var l = L[level];
        if (l.state !== "normal") { rows.push({ name: nameUp + " / " + nameDown.toLowerCase(), none: noteNone[l.state] }); return; }
        l.rise.forEach(function (t) { evt(nameUp, t, "", level === "sun"); });
        l.set.forEach(function (t) { evt(nameDown, t, "", level === "sun"); });
      }
      pair("astro", "Astronomical twilight begins", "Astronomical twilight ends", { "always-above": "Sun stays above −18°: no astronomical night", "always-below": "Sun stays below −18°: dark all day" });
      pair("nautical", "Nautical twilight begins", "Nautical twilight ends", { "always-above": "Sun stays above −12°: no nautical twilight", "always-below": "Sun stays below −12°" });
      pair("civil", "Civil twilight begins", "Civil twilight ends", { "always-above": "Sun stays above −6°: no civil twilight", "always-below": "Sun stays below −6°" });
      pair("sun", "Sunrise", "Sunset", { "always-above": "The Sun does not set (midnight sun)", "always-below": "The Sun does not rise (polar night)" });
      R.transit.forEach(function (t) { evt("Meridian passage (LAN)", t, "altitude " + dm(Math.abs(R.transitAlt)), true); });
      if (R.moon) {
        var lit = Math.round(R.moon.lit * 100) + "% lit, " + (R.moon.waxing ? "waxing" : "waning");
        R.moon.rise.forEach(function (t) { evt("Moonrise", t, lit); }); R.moon.set.forEach(function (t) { evt("Moonset", t, lit); });
        if (!R.moon.rise.length && !R.moon.set.length) rows.push({ name: "Moonrise / moonset", none: "No moonrise or moonset on this date (" + lit + ")" });
        else if (!R.moon.rise.length) rows.push({ name: "Moonrise", none: "No moonrise on this date (" + lit + ")" });
        else if (!R.moon.set.length) rows.push({ name: "Moonset", none: "No moonset on this date (" + lit + ")" });
      }
      var timed = rows.filter(function (r) { return r.ms !== undefined; }).sort(function (a, b) { return a.ms - b.ms; });
      var none = rows.filter(function (r) { return r.none; });
      return { R: R, rows: timed.concat(none), base: base, lonH: lonH };
    }
    function fillTable(tbl, B, v) {
      while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var th = document.createElement("thead"), hr = document.createElement("tr");
      ["Event", "Ship's time (" + zoneTxt(v.zone) + ")", "UTC", "LMT"].forEach(function (h) { var x = document.createElement("th"); x.textContent = h; hr.appendChild(x); }); th.appendChild(hr); tbl.appendChild(th);
      var tb = document.createElement("tbody");
      B.rows.forEach(function (r) {
        var tr = document.createElement("tr"); if (r.key) tr.className = "hit";
        var a = document.createElement("td"); a.textContent = r.name; tr.appendChild(a);
        if (r.none) { var n = document.createElement("td"); n.colSpan = 3; n.className = "muted"; n.textContent = r.none; tr.appendChild(n); }
        else {
          [frame(r.ms, v.zone, B.base), frame(r.ms, 0, B.base), frame(r.ms, B.lonH, B.base)].forEach(function (t, i) { var c = document.createElement("td"); c.textContent = t; if (i === 0) c.className = "su-zt"; tr.appendChild(c); });
          if (r.note) a.title = r.note;
          if (r.note) { var s = document.createElement("span"); s.className = "su-note"; s.textContent = r.note; a.appendChild(s); }
        }
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
    }
    function dateText(v) { var wd = new Date(Date.UTC(v.date.y, v.date.m - 1, v.date.d)).getUTCDay(); return WD[wd] + " " + TIME.p2(v.date.d) + " " + TIME.MONTHS[v.date.m - 1] + " " + v.date.y; }
    function posText(v) { return ns(v.latS) + " " + dm(Math.abs(v.latS)) + "  " + ew(v.lonE) + " " + dm(Math.abs(v.lonE)); }

    function render() {
      var v = read(); save();
      var today = todayISO(), el = $("su-date").value;
      $("su-date-msg").textContent = el && el !== today ? "Not today's date. Press Today to use it." : "";
      $("su-date-msg").className = el && el !== today ? "hint error" : "hint";
      if (!v) { $("su-out").hidden = true; $("su-empty").hidden = false; $("su-head-date").textContent = ""; last = null; suSheet(null); return; }
      var B = build(v), R = B.R, L = R.levels; last = { v: v, B: B, mv: v.speed > 0 };
      $("su-out").hidden = false; $("su-empty").hidden = true; $("su-head-date").textContent = " " + dateText(v);
      var st = $("su-stale"); st.hidden = el === today; st.textContent = "These times are for " + dateText(v) + ", not today.";
      function hero(id, ms, sub, none) { $(id).textContent = ms === null ? "—" : frame(ms, v.zone, B.base); $(id + "-sub").textContent = ms === null ? none : sub; }
      var s = L.sun, sub = "ship's time (" + zoneTxt(v.zone) + ")";
      hero("su-h-rise", s.rise.length ? s.rise[0] : null, sub, s.state === "always-above" ? "The Sun does not set" : s.state === "always-below" ? "The Sun does not rise" : "");
      hero("su-h-set", s.set.length ? s.set[0] : null, sub, s.state === "always-above" ? "midnight sun" : s.state === "always-below" ? "polar night" : "");
      var len = s.rise.length && s.set.length ? (s.set[0] > s.rise[0] ? s.set[0] - s.rise[0] : s.set[0] + 86400000 - s.rise[0]) / 3600000 : (s.state === "always-above" ? 24 : 0);
      $("su-h-len").textContent = hm(len); $("su-h-len-sub").textContent = "sunrise to sunset";
      hero("su-h-lan", R.transit.length ? R.transit[0] : null, R.transit.length ? "altitude " + dm(Math.abs(R.transitAlt)) + " · Dec " + ns(R.dec) + " " + dm(Math.abs(R.dec)) : "", "no meridian passage on this date");
      fillTable($("su-tbl"), B, v);
      var parts = ["Sunrise " + (s.rise.length ? frame(s.rise[0], v.zone, B.base) : "none") + ", Sunset " + (s.set.length ? frame(s.set[0], v.zone, B.base) : "none") + " (ship's time " + zoneTxt(v.zone) + ")"];
      var nt = L.nautical, ct = L.civil;
      if (nt.rise.length && nt.set.length) parts.push("Nautical twilight " + frame(nt.rise[0], v.zone, B.base) + " - " + frame(nt.set[0], v.zone, B.base));
      if (ct.rise.length && ct.set.length) parts.push("Civil twilight " + frame(ct.rise[0], v.zone, B.base) + " - " + frame(ct.set[0], v.zone, B.base));
      if (R.transit.length) parts.push("LAN " + frame(R.transit[0], v.zone, B.base));
      if (R.moon) parts.push("Moonrise " + (R.moon.rise.length ? frame(R.moon.rise[0], v.zone, B.base) : "none") + ", moonset " + (R.moon.set.length ? frame(R.moon.set[0], v.zone, B.base) : "none") + " (" + Math.round(R.moon.lit * 100) + "% lit)");
      if (v.speed > 0) parts.push("under way " + ("00" + Math.round(v.course)).slice(-3) + "° " + v.speed + " kn from the position at " + (v.postime === null ? "12:00" : $("su-postime").value));
      $("su-log").textContent = dateText(v) + " | " + posText(v) + " | " + parts.join(" | ");
      suSheet(last);
    }
    function suSheet(c) {
      var sh = Ships.active();
      fillCells($("su-ps-info"), [["Ship", sh ? sh.name : "—"], ["IMO number", sh && sh.imo ? sh.imo : "—"], ["Date", c ? dateText(c.v) : "—"], ["Position", c ? posText(c.v) : "—", 1]]);
      if (!c) { $("su-ps-rise").textContent = "—"; $("su-ps-set").textContent = "—"; while ($("su-ps-tbl").firstChild) $("su-ps-tbl").removeChild($("su-ps-tbl").firstChild); $("su-ps-log").textContent = ""; return; }
      var s = c.B.R.levels.sun;
      $("su-ps-rise").textContent = s.rise.length ? frame(s.rise[0], c.v.zone, c.B.base) : "none"; $("su-ps-set").textContent = s.set.length ? frame(s.set[0], c.v.zone, c.B.base) : "none";
      fillTable($("su-ps-tbl"), c.B, c.v); $("su-ps-log").textContent = $("su-log").textContent;
    }

    ids.forEach(function (id) { $(id).addEventListener("input", render); });
    $("su-date").addEventListener("change", render);
    ["su-lat-n", "su-lat-s", "su-lon-e", "su-lon-w"].forEach(function (id) { $(id).addEventListener("change", render); });
    $("su-today").addEventListener("click", function () { $("su-date").value = todayISO(); render(); });
    $("su-example").addEventListener("click", function () {
      load({ date: "2024-06-21", zone: "1", latD: "51", latM: "30.4", south: false, lonD: "0", lonM: "7.6", west: true, hoe: "" });
      render(); toast("Example loaded: London, 21 June 2024");
    });
    $("su-clear").addEventListener("click", function () { load({ date: $("su-date").value, zone: $("su-zone").value }); render(); latD.focus(); });
    $("su-print").addEventListener("click", function () { window.print(); });
    window.addEventListener("beforeprint", function () { if (location.hash === "#sun-times") render(); });
    $("su-copy").addEventListener("click", function () { if (last) copyText($("su-log").textContent); });
    Ships.onChange(function () { if (started["sun-times"]) suSheet(last); });
    load(store.get(KEY));
    render();
  }