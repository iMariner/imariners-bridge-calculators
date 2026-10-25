  /* REPORTS-BEGIN */
  /* Vessel daily reportings: distance run, hours and average speed from DTG at each noon report */
  var RP = (function () {
    function num(s) { s = String(s === undefined || s === null ? "" : s).replace(",", ".").trim(); if (s === "") return null; var x = Number(s); return isFinite(x) ? x : NaN; }
    function ok(x) { return x !== null && !isNaN(x); }
    function utcMs(r) {                       /* ship's local date and time, zone East +, to UTC milliseconds */
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.date || ""), t = /^(\d{1,2}):(\d{2})$/.exec(r.time || ""), z = num(r.zone);
      if (!m || !t || !ok(z)) return null;
      return Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]) - z * 3600000;
    }
    function compute(rows) {
      var out = [], sumD = 0, sumH = 0;
      rows.forEach(function (r, i) {
        var o = { utc: utcMs(r), dtg: num(r.dtg), ovr: num(r.ovr), auto: null, dist: null, hours: null, speed: null, warn: "", start: false, done: false };
        if (isNaN(o.dtg)) { o.warn = "DTG is not a number"; o.dtg = null; }
        if (isNaN(o.ovr)) { o.warn = "Override is not a number"; o.ovr = null; }
        var prev = i > 0 ? out[i - 1] : null;
        if (i === 0 || r.type === "cosp") { o.start = true; o.dist = 0; o.hours = 0; }
        else if (rows[i - 1].type === "eosp") { o.start = true; o.dist = 0; o.hours = 0; o.warn = "Arrival was entered above this line. Set this line to Departure to start the next passage."; }
        else {
          if (prev.utc !== null && o.utc !== null) {
            o.hours = (o.utc - prev.utc) / 3600000;
            if (o.hours <= 0) { o.warn = "This time is not after the previous report. Check the date, time and zone."; o.hours = null; }
          }
          if (prev.dtg !== null && o.dtg !== null) o.auto = prev.dtg - o.dtg;
          if (o.ovr !== null) o.dist = o.ovr;
          else if (o.auto !== null) {
            if (o.auto < 0) o.warn = "DTG is higher than the last report. If the route changed, type the distance run in Override.";
            else o.dist = o.auto;
          }
          if (o.dist !== null && o.hours !== null && o.hours > 0) o.speed = o.dist / o.hours;
        }
        o.done = o.dist !== null && o.hours !== null;
        if (o.done) { sumD += o.dist; sumH += o.hours; }
        o.cumDist = sumD; o.cumHours = sumH; o.cumSpeed = sumH > 0 ? sumD / sumH : null;
        out.push(o);
      });
      return out;
    }
    function totals(rows, comp) {
      var t = { dist: 0, hours: 0, speed: null, startDtg: null, lastDtg: null, reports: 0 };
      comp.forEach(function (o, i) { if (o.done && !o.start) { t.dist += o.dist; t.hours += o.hours; t.reports++; } if (o.dtg !== null) { if (t.startDtg === null) t.startDtg = o.dtg; t.lastDtg = o.dtg; } });
      t.speed = t.hours > 0 ? t.dist / t.hours : null;
      return t;
    }
    function monthOf(r) { return (r.date || "").slice(0, 7); }
    function summary(voyages, ym) {              /* distance and time in one month, by condition and by voyage */
      var groups = [], byKey = {}, vrows = [], tot = { dist: 0, hours: 0, reports: 0 };
      voyages.forEach(function (v) {
        var comp = compute(v.rows), d = 0, h = 0, n = 0, label = (v.cond || "").trim() || "Not stated", key = label.toLowerCase(); label = label.charAt(0).toUpperCase() + label.slice(1);
        v.rows.forEach(function (r, i) { var o = comp[i]; if (o.done && !o.start && monthOf(r) === ym) { d += o.dist; h += o.hours; n++; } });
        if (!n) return;
        var g = byKey[key]; if (!g) { g = byKey[key] = { label: label, dist: 0, hours: 0, reports: 0 }; groups.push(g); }
        g.dist += d; g.hours += h; g.reports += n; tot.dist += d; tot.hours += h; tot.reports += n;
        vrows.push({ name: v.name || "Voyage", cond: label, dist: d, hours: h, reports: n });
      });
      groups.forEach(function (g) { g.speed = g.hours > 0 ? g.dist / g.hours : null; });
      vrows.forEach(function (g) { g.speed = g.hours > 0 ? g.dist / g.hours : null; });
      tot.speed = tot.hours > 0 ? tot.dist / tot.hours : null;
      return { groups: groups, voyages: vrows, total: tot };
    }
    function dist(x) { return x === null || x === undefined ? "—" : x.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    function speed(x) { return x === null || x === undefined ? "—" : x.toFixed(2); }
    function dur(h) {
      if (h === null || h === undefined) return "—";
      var mins = Math.round(h * 60), d = Math.floor(mins / 1440), hh = Math.floor((mins % 1440) / 60), mm = mins % 60;
      return (d ? d + " d " : "") + ("0" + hh).slice(-2) + " h " + ("0" + mm).slice(-2) + " m";
    }
    return { num: num, utcMs: utcMs, compute: compute, totals: totals, summary: summary, monthOf: monthOf, fmtDist: dist, fmtSpeed: speed, fmtDur: dur };
  })();
  /* REPORTS-END */

