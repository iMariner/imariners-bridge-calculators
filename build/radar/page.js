  function initRadarPlot() {
    var KEY = "bridgeCalc.radar", TG = ["A", "B", "C"], MAXR = 6;
    var st = store.get(KEY); if (!isObj(st)) st = {};
    if (!isObj(st.own)) st.own = {};
    if (!isObj(st.t)) st.t = {};
    TG.forEach(function (k) { var t = st.t[k]; if (!isObj(t)) t = st.t[k] = {}; if (!Array.isArray(t.rows)) t.rows = []; t.rows = t.rows.filter(isObj).slice(0, MAXR); });
    if (!isObj(st.act)) st.act = {};
    if (TG.indexOf(st.cur) < 0) st.cur = "A";
    var OWN = ["course", "speed", "heading", "ge", "cpa"], ACT = { at: "t", want: "want", nc: "nc", ns: "ns" };
    var HINT = { course: "", speed: "", heading: "Blank = same as course", ge: "Low +, high −", cpa: "", at: "Blank = 6 min after the last plot", want: "", nc: "", ns: "" };
    var last = null;
    function save() { store.set(KEY, st); }
    function p3(x) { return ("00" + Math.round(Radar.n360(x)) % 360).slice(-3); }
    function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
    function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
    function msg(id, err) { var m = $("rp-" + id + "-msg"), f = $("rp-" + id); if (m) { m.textContent = err || HINT[id] || ""; m.className = err ? "hint error" : "hint"; } if (f) f.setAttribute("aria-invalid", err ? "true" : "false"); }
    function side(rb) { var a = Math.abs(rb); return a < 1 ? "dead ahead" : a > 179 ? "right astern" : (rb > 0 ? "Green " : "Red ") + Math.round(a) + "°"; }
    function rbWords(rb) { var a = Math.abs(rb), s = rb > 0 ? "starboard" : "port"; return a < 6 ? "ahead" : a < 80 ? "on the " + s + " bow" : a <= 100 ? "abeam to " + s : a < 168 ? "on the " + s + " quarter" : "astern"; }

    /* ---------- the form ---------- */
    function rowsBox() {
      var tb = $("rp-obs-body"), t = st.t[st.cur], n = Math.max(3, Math.min(MAXR, t.rows.length + (t.rows.length && filled(t.rows[t.rows.length - 1]) ? 1 : 0)));
      tb.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var r = t.rows[i] || {}, tr = el("tr");
        tr.appendChild(el("td", "rp-n", String(i + 1)));
        [["t", "hh:mm", "numeric", 5], ["b", "000", "decimal", 5], ["r", "0.0", "decimal", 5]].forEach(function (c) {
          var td = el("td"), inp = el("input", "text-input"); inp.type = "text"; inp.placeholder = c[1]; inp.inputMode = c[2]; inp.maxLength = c[3];
          inp.value = r[c[0]] === undefined ? "" : r[c[0]]; inp.setAttribute("data-i", i); inp.setAttribute("data-k", c[0]);
          inp.setAttribute("aria-label", ["Time", "Bearing", "Range"][["t", "b", "r"].indexOf(c[0])] + " of plot " + (i + 1));
          td.appendChild(inp); tr.appendChild(td);
        });
        tb.appendChild(tr);
      }
      $("rp-addrow").disabled = n >= MAXR;
      $("rp-fixed").checked = !!t.fixed;
      $("rp-res-h").textContent = "Target " + st.cur + (t.fixed ? " (fixed object)" : "");
    }
    function filled(r) { return r && (r.t || r.b || r.r); }
    function load() {
      OWN.forEach(function (k) { $("rp-" + k).value = st.own[k] === undefined ? "" : st.own[k]; });
      $(st.own.bt === "rel" ? "rp-bt-rel" : "rp-bt-true").checked = true;
      $("rp-tg-" + st.cur).checked = true;
      var a = st.act; $("rp-act-" + (["none", "fc", "fs", "me"].indexOf(a.type) >= 0 ? a.type : "none")).checked = true;
      Object.keys(ACT).forEach(function (k) { $("rp-" + k).value = a[ACT[k]] === undefined ? "" : a[ACT[k]]; });
      rowsBox();
    }
    function modeUi() {
      var rel = $("rp-bt-rel").checked, at = actType();
      $("rp-hd-f").hidden = !rel; $("rp-ge-f").hidden = rel;
      $("rp-brg-h").textContent = rel ? "Rel. bearing °" : "Bearing °T";
      $("rp-act-box").hidden = at === "none"; $("rp-me-f").hidden = at !== "me"; $("rp-want-f").hidden = at === "me";
    }
    function actType() { return $("rp-act-fc").checked ? "fc" : $("rp-act-fs").checked ? "fs" : $("rp-act-me").checked ? "me" : "none"; }

    /* ---------- reading ---------- */
    function rd(id, lo, hi, opt, what) {
      var v = parseNum($("rp-" + id));
      if (v === null) { if (opt) { msg(id); return null; } msg(id, "Needed"); return NaN; }
      if (isNaN(v) || v < lo || v > hi) { msg(id, what || (lo + " to " + hi)); return NaN; }
      msg(id); return v;
    }
    function read() {
      var v = { course: rd("course", 0, 360), speed: rd("speed", 0, 40, false, "0 to 40 kn"), rel: $("rp-bt-rel").checked };
      v.heading = v.rel ? rd("heading", 0, 360, true) : null; if (!v.rel) msg("heading");
      v.ge = v.rel ? 0 : rd("ge", -10, 10, true, "−10 to +10"); if (v.rel) msg("ge");
      v.cpa = rd("cpa", 0.1, 12, true, "0.1 to 12 NM"); if (v.cpa === null) v.cpa = 2;
      v.ok = [v.course, v.speed, v.heading, v.ge, v.cpa].every(function (x) { return x === null || isFinite(x); }) && v.course !== null && v.speed !== null;
      if (v.heading === null) v.heading = v.course;
      v.targets = {};
      TG.forEach(function (k) {
        var rows = st.t[k].rows, obs = [], bad = [];
        rows.forEach(function (r, i) {
          if (!filled(r)) return;
          var m = Radar.minutes(r.t), b = parseNum({ value: String(r.b || "") }), g = parseNum({ value: String(r.r || "") });
          var e = { t: m === null, b: b === null || isNaN(b) || b < 0 || b > 360, r: g === null || isNaN(g) || g <= 0 || g > 48 };
          if (e.t || e.b || e.r) bad.push({ i: i, e: e }); else obs.push({ t: r.t, brg: b, rng: g, i: i });
        });
        v.targets[k] = { obs: obs, bad: bad, fixed: !!st.t[k].fixed };
      });
      return v;
    }
    function caseOf(v, k, action) {
      var t = v.targets[k];
      return { own: { course: v.course, speed: v.speed }, brgType: v.rel ? "rel" : "true", heading: v.heading, ge: v.ge || 0, obs: t.obs, fixed: t.fixed, cpaLimit: v.cpa, action: action };
    }
    function markRows(t) {
      var ins = $("rp-obs-body").querySelectorAll("input");
      for (var j = 0; j < ins.length; j++) ins[j].setAttribute("aria-invalid", "false");
      t.bad.forEach(function (b) { ["t", "b", "r"].forEach(function (k) { if (b.e[k]) { var x = $("rp-obs-body").querySelector('input[data-i="' + b.i + '"][data-k="' + k + '"]'); if (x) x.setAttribute("aria-invalid", "true"); } }); });
    }

    /* ---------- solving ---------- */
    function compute() {
      var v = read(), t = v.targets[st.cur], at = actType(), out = { v: v, res: {}, act: null };
      markRows(t);
      $("rp-obs-msg").className = t.bad.length ? "hint error" : "hint";
      $("rp-obs-msg").textContent = t.bad.length ? "Check the boxes in red: time as 10:06 or 1006, bearing 000 to 360, range above 0." : "Times as 10:06 or 1006. Plot every 6 minutes if you can; 3 plots show if the target alters.";
      if (!v.ok || t.obs.length < 2) return null;
      TG.forEach(function (k) {
        if (v.targets[k].obs.length < 2) return;
        try { var r = Radar.solve(Radar.normalize(caseOf(v, k))); if (!r.error) out.res[k] = r; else if (k === st.cur) out.err = r.error; } catch (e) { if (k === st.cur) out.err = e && e.user ? e.message : "Check the times."; }
      });
      if (!out.res[st.cur]) return out;
      if (at !== "none") {
        var cur = out.res[st.cur], lastM = 0;
        Object.keys(out.res).forEach(function (k) { lastM = Math.max(lastM, out.res[k].tA); });
        var atv = $("rp-at").value.trim(), am = atv === "" ? lastM + 6 : Radar.minutes(atv);
        msg("at", am === null ? "Time as 10:18 or 1018" : null);
        var want = at === "me" ? null : rd("want", 0.1, 12, true, "0.1 to 12 NM"); if (at === "me") msg("want");
        var nc = at === "me" ? rd("nc", 0, 360, true) : null, ns = at === "me" ? rd("ns", 0, 40, true, "0 to 40 kn") : null; if (at !== "me") { msg("nc"); msg("ns"); }
        if (am !== null && [want, nc, ns].every(function (x) { return x === null || isFinite(x); })) {
          if (want === null) want = v.cpa;
          var base = { t: Radar.clock(am), want: want };
          if (at === "fc") base.find = "course"; else if (at === "fs") base.find = "speed"; else { base.course = nc; base.speed = ns; }
          var a0 = Radar.solve(Radar.normalize(caseOf(v, st.cur, base))).action;
          out.act = { type: at, want: want, m: am, time: Radar.clock(am), main: a0, all: {} };
          if (!a0.error) Object.keys(out.res).forEach(function (k) {
            if (k === st.cur) { out.act.all[k] = a0; return; }
            var o = Radar.solve(Radar.normalize(caseOf(v, k, { t: base.t, course: a0.course, speed: a0.speed, want: want })));
            out.act.all[k] = o.action;
          });
        }
      }
      return out;
    }

    /* ---------- showing ---------- */
    function lights(asp) { if (asp === null) return "—"; var a = Math.abs(asp); return a > 112.5 ? "Sternlight" : "Masthead light(s) and " + (a < 3 ? "both sidelights" : asp < 0 ? "red sidelight" : "green sidelight"); }
    function situation(r, v, t) {
      if (t.fixed || r.aspect === null || r.cpa.passed || r.cpa.steady) return null;
      var rb = Radar.relBrg(Radar.dirOf(r.A), v.heading), a = Math.abs(r.aspect), q = r.risk ? "" : " if risk of collision develops";
      if (a > 112.5 && Math.abs(rb) < 90) return "You are overtaking: keep out of the way (Rule 13)";
      if (Math.abs(rb) > 112.5) return "Being overtaken: stand on" + q + " (Rules 13 and 17)";
      if (Math.abs(rb) < 6 && a < 6) return "Head-on: both alter to starboard" + q + " (Rule 14)";
      return rb > 0 ? "Crossing, target on your starboard side: give way" + q + " (Rules 15 and 16)" : "Crossing, target on your port side: stand on" + q + " (Rules 15 and 17)";
    }
    function render() {
      modeUi();
      var o = compute(); last = o;
      var has = o && o.res[st.cur];
      $("rp-empty").hidden = !!has; $("rp-out").hidden = !has; $("rp-plot-card").hidden = !has; $("rp-steps-card").hidden = !has; $("rp-act-card").hidden = !(has && o.act);
      $("rp-sheet").classList.toggle("no-print", !has);
      if (!has) { $("rp-empty").textContent = o && o.err ? o.err : "Enter own course and speed, and the time, bearing and range of the target at two or more times."; return; }
      var v = o.v, r = o.res[st.cur], t = v.targets[st.cur], wk = $("rp-wk"), rows = [];
      /* verdict */
      var vd = $("rp-verdict"), safe = v.cpa;
      if (t.fixed) { vd.className = "callout"; vd.textContent = "Fixed object: your ground track is " + p3(r.ground.course) + "° at " + f1(r.ground.speed) + " kn; the current sets " + p3(r.ground.set) + "° at " + f1(r.ground.drift) + " kn." + (r.cpa.p ? " It passes " + f1(r.cpa.range) + " NM off at " + r.cpa.time + (r.risk ? ", inside your safe CPA of " + f1(safe) + " NM." : ".") : ""); }
      else if (r.cpa.steady) { vd.className = "callout"; vd.textContent = "Range and bearing steady: the target keeps station on you."; }
      else if (r.cpa.passed) { vd.className = "callout rp-ok"; vd.textContent = "Opening: the CPA has passed, range now " + f1(r.cpa.range) + " NM."; }
      else if (r.risk) { vd.className = "callout rp-bad"; vd.textContent = (r.cbdr ? "Risk of collision, bearing steady. " : "Risk of collision. ") + "CPA " + f1(r.cpa.range) + " NM at " + r.cpa.time + " (in " + Math.round(r.cpa.tcpa) + " min), inside your safe CPA of " + f1(safe) + " NM."; }
      else { vd.className = "callout rp-ok"; vd.textContent = "Passes clear: CPA " + f1(r.cpa.range) + " NM at " + r.cpa.time + ", outside your safe CPA of " + f1(safe) + " NM."; }
      /* readouts */
      var pass = r.cpa.passed || r.cpa.steady;
      $("rp-cpa-v").textContent = f1(r.cpa.range) + " NM"; $("rp-cpa-s").textContent = pass ? (r.cpa.steady ? "range steady" : "passed, opening") : "bearing " + p3(r.cpa.brg) + "°";
      $("rp-tcpa-v").textContent = pass ? "—" : Math.round(r.cpa.tcpa) + " min"; $("rp-tcpa-s").textContent = pass ? "" : "at " + r.cpa.time;
      if (t.fixed) {
        $("rp-tc-v").parentNode.querySelector(".readout-label").textContent = "Course made good"; $("rp-tc-v").textContent = p3(r.ground.course) + "°"; $("rp-tc-s").textContent = f1(r.ground.speed) + " kn over the ground";
        $("rp-asp-v").parentNode.querySelector(".readout-label").textContent = "Set and drift"; $("rp-asp-v").textContent = p3(r.ground.set) + "°"; $("rp-asp-s").textContent = f1(r.ground.drift) + " kn";
      } else {
        $("rp-tc-v").parentNode.querySelector(".readout-label").textContent = "Target course"; $("rp-tc-v").textContent = r.tgt.speed < 0.2 ? "Stopped" : p3(r.tgt.course) + "°"; $("rp-tc-s").textContent = f1(r.tgt.speed) + " kn";
        $("rp-asp-v").parentNode.querySelector(".readout-label").textContent = "Aspect"; $("rp-asp-v").textContent = r.aspect === null ? "—" : side(r.aspect); $("rp-asp-s").textContent = r.aspect === null ? "" : lights(r.aspect);
      }
      /* working */
      var rbA = Radar.relBrg(Radar.dirOf(r.A), v.heading);
      rows.push(["Relative track (O to A)", p3(r.rel.course) + "° · " + f1(r.rel.speed) + " kn", f1(r.rel.dist) + " NM in " + Math.round(r.dt) + " min"]);
      rows.push(["Own ship (W to O)", p3(r.own.course) + "° · " + f1(r.own.speed) + " kn", f1(r.own.dist) + " NM in " + Math.round(r.dt) + " min"]);
      rows.push([t.fixed ? "W to A (current, reversed)" : "Target (W to A)", p3(r.tgt.course) + "° · " + f1(r.tgt.speed) + " kn", f1(r.tgt.dist) + " NM in " + Math.round(r.dt) + " min"]);
      rows.push(["Target now (" + Radar.clock(r.tA) + ")", p3(Radar.dirOf(r.A)) + "° · " + f1(Math.sqrt(r.A.x * r.A.x + r.A.y * r.A.y)) + " NM", side(rbA) + ", " + rbWords(rbA)]);
      rows.push(["Bearing change", Math.abs(r.brgChange) < 1 ? "steady" : (r.brgChange > 0 ? "+" : "−") + Math.round(Math.abs(r.brgChange)) + "°", Math.abs(r.brgChange) < 1 ? (r.rngChange < 0 ? "range closing: risk of collision (Rule 7)" : "") : "drawing " + (r.brgChange > 0 ? "right" : "left") + ", range " + (r.rngChange < 0 ? "closing " : "opening ") + f1(Math.abs(r.rngChange)) + " NM"]);
      if (r.bcr) rows.push(["Crosses ahead (BCR)", f1(r.bcr.range) + " NM", "in " + Math.round(r.bcr.t) + " min, at " + r.bcr.time]);
      if (r.scr) rows.push(["Crosses astern", f1(r.scr.range) + " NM", "in " + Math.round(r.scr.t) + " min, at " + r.scr.time]);
      var sit = situation(r, v, t); if (sit) rows.push(["If in sight", sit, "In fog Rule 19 applies to both: no stand-on vessel"]);
      if (r.mid.length) rows.push(["Middle plots", r.mid.every(function (m) { return !m.bad; }) ? "on the line" : "off the line", r.mid.map(function (m) { return f1(m.off) + " NM"; }).join(", ") + " from O to A"]);
      wk.innerHTML = ""; rows.forEach(function (x) { var tr = el("tr"); x.forEach(function (c) { tr.appendChild(el("td", "", c)); }); wk.appendChild(tr); });
      var wn = $("rp-warn"); wn.hidden = !r.warn.length; wn.textContent = r.warn.join(" ");
      if (o.act) actionCard(o);
      var rot = v.rel ? v.heading : 0;
      $("rp-plot").innerHTML = plot(r, o.act && !o.act.main.error ? o.act.main : null, v, rot, "rpa");
      $("rp-key").innerHTML = keyHtml(r, o);
      stepsInto($("rp-steps"), r, o, rot);
      sheet(o, r, rot);
    }
    function actWords(a, v) {
      if (a.error) return a.error;
      var dc = Radar.n180(a.course - v.course), ds = a.speed - v.speed;
      var w = Math.abs(dc) >= 0.5 ? "Alter course to " + p3(a.course) + "° (" + Math.round(Math.abs(dc)) + "° to " + (dc > 0 ? "starboard" : "port") + ")" : "";
      if (Math.abs(ds) >= 0.05) w += (w ? " and " : "") + (ds < 0 ? "reduce speed to " : "increase speed to ") + f1(a.speed) + " kn";
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : "No change needed";
    }
    function fwdNotOvertaken(r, brg, v) { var rb = Radar.relBrg(brg, v.heading); return Math.abs(rb) < 90 && !(r.aspect !== null && Math.abs(r.aspect) > 112.5); }
    function ruleNotes(o) {
      var v = o.v, a = o.act.main, notes = [];
      if (a.error) return notes;
      var dc = Radar.n180(a.course - v.course);
      Object.keys(o.act.all).forEach(function (k) {
        var x = o.act.all[k], r = o.res[k]; if (!x || x.error || v.targets[k].fixed) return;
        var rb = Radar.relBrg(x.brgAt, v.heading);
        if (fwdNotOvertaken(r, x.brgAt, v) && dc < -0.5) notes.push({ bad: true, t: "Target " + k + " is forward of the beam: Rule 19(d)(i) says avoid an alteration to port (unless you are overtaking it)." });
        if (Math.abs(rb) >= 90 && Math.abs(dc) > 0.5 && dc * rb > 0) notes.push({ bad: true, t: "Target " + k + " is abeam or abaft the beam on your " + (rb > 0 ? "starboard" : "port") + " side: Rule 19(d)(ii) says avoid an alteration towards it." });
        if (x.cpa < o.act.want - 0.005) notes.push({ bad: true, t: "Target " + k + ": this action leaves a CPA of " + f1(x.cpa) + " NM, less than " + f1(o.act.want) + " NM." });
      });
      if (Math.abs(dc) > 0.5 && Math.abs(dc) < 30) notes.push({ t: "Rule 8: make the alteration large enough to be readily seen on the other ship's radar; 30° or more is usual." });
      if (a.speed < v.speed - 0.05) notes.push({ t: "Rule 8: a reduction of speed should be substantial. The ship takes time to slow down; this plot assumes the new speed at once." });
      notes.push({ t: "The plot takes the new course and speed at once. Act early and allow for the turn. Keep plotting after the action to check it works (Rule 8(d))." });
      notes.push({ t: "In restricted visibility Rule 19 applies; if the vessels are in sight of one another, Rules 11 to 18 apply instead." });
      return notes;
    }
    function actionCard(o) {
      var v = o.v, a = o.act.main, vd = $("rp-act-verdict"), tb = $("rp-act-tbl"), ul = $("rp-rules");
      var head = o.act.type === "fc" ? "Course for a CPA of " + f1(o.act.want) + " NM from Target " + st.cur : o.act.type === "fs" ? "Speed for a CPA of " + f1(o.act.want) + " NM from Target " + st.cur : "Your action";
      if (a.error) { vd.className = "callout rp-bad"; vd.textContent = head + ": " + a.error + (a.portCourse !== undefined && a.portCourse !== null ? " (A turn to port, to " + p3(a.portCourse) + "°, would; check Rule 19 first.)" : ""); }
      else {
        var ok = Object.keys(o.act.all).every(function (k) { var x = o.act.all[k]; return x && !x.error && x.cpa >= o.act.want - 0.005; });
        vd.className = "callout " + (ok ? "rp-ok" : "rp-bad");
        vd.textContent = head + " at " + o.act.time + ": " + actWords(a, v) + "." + (a.resume ? " Resume " + p3(v.course) + "° " + (a.speed !== v.speed ? "and " + f1(v.speed) + " kn " : "") + "at " + a.resume.time + "." : "") + (o.act.type === "fc" && a.portTurn !== null && a.portTurn !== undefined && a.portTurn < a.stbdTurn ? " (" + a.portTurn + "° to port would also do it" + (fwdNotOvertaken(o.res[st.cur], a.brgAt, v) ? ", but Rule 19(d)(i) says avoid a turn to port for a vessel forward of the beam" : "") + ".)" : "");
      }
      tb.innerHTML = "";
      var hr = el("tr"); ["Target", "CPA now", "Range at " + o.act.time, "CPA after", "At", "Resume at"].forEach(function (h) { hr.appendChild(el("th", "", h)); }); var th = el("thead"); th.appendChild(hr); tb.appendChild(th);
      var bd = el("tbody");
      Object.keys(o.res).sort().forEach(function (k) {
        var r = o.res[k], x = o.act.all[k], tr = el("tr");
        tr.appendChild(el("td", "", k + (v.targets[k].fixed ? " (fixed)" : "")));
        tr.appendChild(el("td", "", r.cpa.passed || r.cpa.steady ? "passed" : f1(r.cpa.range) + " NM"));
        if (!x || x.error) { tr.appendChild(el("td", "", x && x.rangeAt !== undefined ? f1(x.rangeAt) : "—")); tr.appendChild(el("td", "rp-bad", x ? x.error || "—" : "—")); tr.appendChild(el("td", "", "")); tr.appendChild(el("td", "", "")); }
        else {
          tr.appendChild(el("td", "", f1(x.rangeAt) + " NM " + p3(x.brgAt) + "°"));
          tr.appendChild(el("td", x.cpa < o.act.want - 0.005 ? "rp-bad" : "", x.passed ? "opening" : f1(x.cpa) + " NM"));
          tr.appendChild(el("td", "", x.passed ? "—" : x.time));
          tr.appendChild(el("td", "", x.resume ? (x.resume.after < 0.05 ? "not needed" : x.resume.time) : "—"));
        }
        bd.appendChild(tr);
      });
      tb.appendChild(bd);
      ul.innerHTML = ""; ruleNotes(o).forEach(function (n) { ul.appendChild(el("li", n.bad ? "rp-bad" : "", n.t)); });
    }

    /* ---------- the plot (a radar plotting sheet) ---------- */
    function scaleOf(r, a, v) {   /* outer ring in NM, the same for the plot and the steps */
      var pts = [r.O, r.A, r.W, { x: v.cpa, y: 0 }]; if (r.cpa.p) pts.push(r.cpa.p);
      if (a) { pts.push(a.P, { x: r.W.x + a.Vo2.x * r.dt / 60, y: r.W.y + a.Vo2.y * r.dt / 60 }); if (a.cpaP) pts.push(a.cpaP); if (a.resume) pts.push(a.resume.Q); }
      r.pos.forEach(function (p) { pts.push(p); });
      var mx = 0; pts.forEach(function (p) { mx = Math.max(mx, Math.sqrt(p.x * p.x + p.y * p.y)); });
      var scales = [0.75, 1.5, 3, 6, 12, 24, 48, 96];
      for (var i = 0; i < scales.length; i++) if (mx <= scales[i] * 1.12) return scales[i];
      return scales[scales.length - 1];
    }
    function plot(r, a, v, rot, id) {
      var C = 320, RR = 262, R2 = Math.PI / 180, out = [], i;
      var sc = scaleOf(r, a, v), k = RR / sc, cr = Math.cos(rot * R2), sr = Math.sin(rot * R2);
      function X(p) { return C + (p.x * cr - p.y * sr) * k; }
      function Y(p) { return C - (p.y * cr + p.x * sr) * k; }
      function n(x) { return (Math.round(x * 10) / 10).toString(); }
      function line(p, q, cls) { out.push('<line class="' + cls + '" x1="' + n(X(p)) + '" y1="' + n(Y(p)) + '" x2="' + n(X(q)) + '" y2="' + n(Y(q)) + '"/>'); }
      function head(p, q, cls, at) {   /* arrowhead pointing from p to q, placed at fraction "at" along it */
        var x1 = X(p), y1 = Y(p), x2 = X(q), y2 = Y(q), L = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)); if (L < 14) return;
        var ux = (x2 - x1) / L, uy = (y2 - y1) / L, hx = x1 + (x2 - x1) * at, hy = y1 + (y2 - y1) * at;
        out.push('<path class="' + cls + '" d="M' + n(hx + ux * 7) + ' ' + n(hy + uy * 7) + 'L' + n(hx - ux * 7 - uy * 5) + ' ' + n(hy - uy * 7 + ux * 5) + 'L' + n(hx - ux * 7 + uy * 5) + ' ' + n(hy - uy * 7 - ux * 5) + 'Z"/>');
      }
      function lab(p, txt, cls, dx, dy) { out.push('<text class="' + (cls || "rp-lab") + '" x="' + n(X(p) + (dx || 0)) + '" y="' + n(Y(p) + (dy || 0)) + '">' + txt + '</text>'); }
      function off(p, d) { var l = Math.sqrt(p.x * p.x + p.y * p.y) || 1; return { dx: (p.x * cr - p.y * sr) / l * d, dy: -(p.y * cr + p.x * sr) / l * d }; }
      /* rings, rim, bearing scale (sheet bearings: true for north up, relative for head up) */
      for (i = 1; i <= 6; i++) out.push('<circle class="rp-ring" cx="' + C + '" cy="' + C + '" r="' + n(RR * i / 6) + '"/>');
      out.push('<circle class="rp-rim" cx="' + C + '" cy="' + C + '" r="' + RR + '"/>');
      for (i = 0; i < 360; i += 5) {
        var s = Math.sin(i * R2), c = Math.cos(i * R2), l0 = i % 30 === 0 ? 14 : i % 10 === 0 ? 9 : 5;
        out.push('<line class="rp-tick" x1="' + n(C + s * RR) + '" y1="' + n(C - c * RR) + '" x2="' + n(C + s * (RR + l0)) + '" y2="' + n(C - c * (RR + l0)) + '"/>');
        if (i % 30 === 0) out.push('<text class="rp-tl" text-anchor="middle" x="' + n(C + s * (RR + 30)) + '" y="' + n(C - c * (RR + 30) + 5) + '">' + ("00" + i).slice(-3) + '</text>');
      }
      for (i = 1; i <= 6; i++) { var rv = sc * i / 6; out.push('<text class="rp-rl" x="' + n(C + RR * i / 6 - 3) + '" y="' + (C + 15) + '" text-anchor="end">' + (rv % 1 ? rv.toFixed(2).replace(/0$/, "") : rv) + '</text>'); }
      out.push('<text class="rp-rl" x="' + (C + RR - 2) + '" y="' + (C + 30) + '" text-anchor="end">NM</text>');
      /* own heading line, safe CPA circle */
      var hu = Radar.vec(v.heading, sc); line({ x: 0, y: 0 }, hu, "rp-head");
      out.push('<circle class="rp-safe" cx="' + C + '" cy="' + C + '" r="' + n(v.cpa * k) + '"/>');
      /* relative track O to A, extended past the CPA */
      var ext = r.cpa.p ? { x: r.cpa.p.x + r.Vr.x * 0.15 * Math.max(1, r.cpa.tcpa / 60), y: r.cpa.p.y + r.Vr.y * 0.15 * Math.max(1, r.cpa.tcpa / 60) } : { x: r.A.x + r.Vr.x * r.dt / 120, y: r.A.y + r.Vr.y * r.dt / 120 };
      line(r.A, ext, "rp-ext");
      line(r.O, r.A, "rp-relt"); head(r.O, r.A, "ah-rel", 0.55); head(r.O, r.A, "ah-rel", 0.67);
      if (r.cpa.p) { line({ x: 0, y: 0 }, r.cpa.p, "rp-cpa"); lab(r.cpa.p, "CPA " + f1(r.cpa.range), "rp-sub", off(r.cpa.p, 14).dx + 4, off(r.cpa.p, 14).dy + 4); }
      /* the triangle: W to O own ship, W to A target */
      line(r.W, r.O, "rp-own"); head(r.W, r.O, "ah-own", 0.6);
      line(r.W, r.A, "rp-tru"); head(r.W, r.A, "ah-tru", 0.6); head(r.W, r.A, "ah-tru", 0.68);
      /* action: P, new own vector W to O', new relative track from P, resume point R */
      if (a) {
        var O2 = { x: r.W.x + a.Vo2.x * r.dt / 60, y: r.W.y + a.Vo2.y * r.dt / 60 };
        if (Math.abs(O2.x - r.O.x) + Math.abs(O2.y - r.O.y) > 1e-6) { line(r.W, O2, "rp-new"); head(r.W, O2, "ah-new", 0.6); line(O2, r.A, "rp-newx"); out.push('<circle class="rp-pt" cx="' + n(X(O2)) + '" cy="' + n(Y(O2)) + '" r="3.5"/>'); lab(O2, "O'", "rp-lab", 8, -8); }
        var endN = a.resume ? a.resume.Q : a.cpaP;
        if (endN) { line(a.P, endN, "rp-new"); head(a.P, endN, "ah-new", 0.5); }
        if (!a.passed && a.cpaP && a.resume) line(a.resume.Q, a.cpaP, "rp-newx");
        if (!a.passed && a.cpaP) line({ x: 0, y: 0 }, a.cpaP, "rp-new");
        out.push('<circle class="rp-dot" cx="' + n(X(a.P)) + '" cy="' + n(Y(a.P)) + '" r="5"/>'); lab(a.P, "P " + Radar.clock(a.m), "rp-lab", off(a.P, 16).dx + 6, off(a.P, 16).dy);
        if (a.resume) {
          var Rq = a.resume.Q, far = { x: Rq.x + r.Vr.x, y: Rq.y + r.Vr.y }, vl = closestOut(Rq, r.Vr);
          line(Rq, vl, "rp-res");
          out.push('<circle class="rp-dot" cx="' + n(X(Rq)) + '" cy="' + n(Y(Rq)) + '" r="5"/>'); lab(Rq, "R " + a.resume.time, "rp-lab", off(Rq, 16).dx + 6, off(Rq, 16).dy);
        }
      }
      function closestOut(p, vv) { var q = Radar.closest(p, vv), t = q.open ? 0.25 : q.t / 60 * 1.3 + 0.05; return { x: p.x + vv.x * t, y: p.y + vv.y * t }; }
      /* plots and labels */
      r.pos.forEach(function (p, j) {
        out.push('<circle class="rp-dot" cx="' + n(X(p)) + '" cy="' + n(Y(p)) + '" r="5"/>');
        var ob = last && last.v.targets[st.cur].obs[j], o2 = off(p, 18);
        var nm = j === 0 ? "O " : j === r.pos.length - 1 ? "A " : "";
        lab(p, nm + (ob ? Radar.clock(Radar.minutes(ob.t)) : ""), j === 0 || j === r.pos.length - 1 ? "rp-lab" : "rp-sub", o2.dx + (o2.dx < 0 ? -48 : 4), o2.dy + 4);
      });
      lab(r.W, "W", "rp-lab", -18, 5);
      /* own ship at the centre */
      var hs = Radar.n360(v.heading - rot) * R2, sx = Math.sin(hs), cy = Math.cos(hs);
      out.push('<path class="rp-ship" d="M' + n(C + sx * 11) + ' ' + n(C - cy * 11) + 'L' + n(C - sx * 7 + cy * 6) + ' ' + n(C + cy * 7 + sx * 6) + 'L' + n(C - sx * 7 - cy * 6) + ' ' + n(C + cy * 7 - sx * 6) + 'Z"/>');
      out.push('<text class="rp-sub" x="16" y="24">' + (v.rel ? "Head up, heading " + p3(rot) + "°" : "North up") + ' · rings ' + (sc / 6) + ' NM</text>');
      return out.join("");
    }
    function keyHtml(r, o) {
      var k = [["k-own", "W to O: own ship"], ["k-rel", "O to A: relative track"], ["k-tru", o.v.targets[st.cur].fixed ? "W to A: current, reversed" : "W to A: target's course"], ["k-cpa", "CPA"], ["k-safe", "safe CPA " + f1(o.v.cpa) + " NM"]];
      if (o.act && !o.act.main.error) { k.push(["k-new", "action: new course / speed and track from P"]); if (o.act.main.resume) k.push(["k-res", "after resuming at R"]); }
      return k.map(function (x) { return '<span><i class="' + x[0] + '"></i>' + x[1] + '</span>'; }).join("");
    }

    /* ---------- step by step, for a blank plotting sheet ---------- */
    function steps(r, o, rot) {
      var v = o.v, t = v.targets[st.cur], B = [], dt = Math.round(r.dt), a = o.act && !o.act.main.error ? o.act.main : null, hu = v.rel;
      var sc = scaleOf(r, a, v);
      function sh(d) { return p3(d - rot) + "°"; }                         /* a direction as drawn on the sheet */
      function both(d) { return hu ? sh(d) + " on the sheet (true " + p3(d) + "°)" : p3(d) + "°"; }
      B.push({ h: "Set up the sheet", s: [
        "Use rings every " + (sc / 6) + " NM (outer ring " + sc + " NM).",
        hu ? "Head up: 000 on the sheet is the ship's head (heading " + p3(rot) + "°). Bearings are relative; add the heading to get true." : "North up: 000 on the sheet is true north. Bearings are true.",
        "Draw your heading line from the centre on " + sh(v.heading) + ". Draw the safe CPA circle, radius " + f1(v.cpa) + " NM." ] });
      var pl = t.obs.map(function (ob, j) { var gb = +ob.brg, tb = v.rel ? gb : Radar.n360(gb + (v.ge || 0)); return "At " + Radar.clock(Radar.minutes(ob.t)) + " plot " + (v.rel ? "relative bearing " + p3(gb) + "°" : "bearing " + p3(tb) + "°" + (v.ge ? " (gyro " + p3(gb) + "° " + (v.ge > 0 ? "+ " : "− ") + Math.abs(v.ge) + "°)" : "")) + ", range " + f1(+ob.rng) + " NM." + (j === 0 ? " Mark it O." : j === t.obs.length - 1 ? " Mark it A." : ""); });
      pl.push("O to A is " + dt + " minutes.");
      B.push({ h: "Plot the target", s: pl });
      var rs = ["Join O to A and carry the line on beyond A: this is the relative track, " + sh(r.rel.course) + ".",
        "Measure O to A: " + f2(r.rel.dist) + " NM. Relative speed = " + f2(r.rel.dist) + " × 60 ÷ " + dt + " = " + f1(r.rel.speed) + " kn."];
      if (r.mid.length) rs.push(r.mid.every(function (m) { return !m.bad; }) ? "The middle plot" + (r.mid.length > 1 ? "s lie" : " lies") + " on the line: the target is steady on course and speed." : "A middle plot is off the line: the target may be altering. Keep plotting before you trust the answers.");
      B.push({ h: "Relative track", s: rs });
      if (r.cpa.p) B.push({ h: "CPA and TCPA", s: [
        "From the centre draw a line at right angles to the relative track. Where it meets the track is the CPA: " + f1(r.cpa.range) + " NM, bearing " + both(r.cpa.brg) + ".",
        "Measure A to the CPA point: " + f2(r.rel.speed * r.cpa.tcpa / 60) + " NM. TCPA = " + f2(r.rel.speed * r.cpa.tcpa / 60) + " × 60 ÷ " + f1(r.rel.speed) + " = " + Math.round(r.cpa.tcpa) + " min, at " + r.cpa.time + ".",
        r.risk ? "The CPA is inside the safe circle: risk of collision. Take action (Rules 7, 8 and 19)." : "The track stays outside the safe circle." ] });
      else B.push({ h: "CPA", s: [r.cpa.steady ? "The plots do not move: range and bearing steady." : "The track leads away from the centre: the closest point has passed. Range now " + f1(r.cpa.range) + " NM."] });
      var tr = ["From O draw the line back along your course reversed: W is " + f2(r.own.dist) + " NM from O (" + f1(v.speed) + " kn × " + dt + " ÷ 60). WO runs on " + sh(v.course) + " towards O." + (hu && Math.abs(Radar.n180(v.course - v.heading)) < 0.5 ? " On a head-up sheet WO runs straight up, parallel to the heading line." : "")];
      if (t.fixed) tr.push("Join W to A. The object is not moving, so W to A is the current reversed: set = direction A to W = " + both(r.ground.set) + ", drift = " + f2(r.tgt.dist) + " × 60 ÷ " + dt + " = " + f1(r.ground.drift) + " kn.", "Your course made good is the relative track reversed: " + both(r.ground.course) + " at " + f1(r.ground.speed) + " kn.");
      else {
        tr.push("Join W to A: this is the target's true course and speed. Course = direction W to A = " + both(r.tgt.course) + ". WA = " + f2(r.tgt.dist) + " NM, so speed = " + f2(r.tgt.dist) + " × 60 ÷ " + dt + " = " + f1(r.tgt.speed) + " kn.");
        if (r.aspect !== null) tr.push("Aspect: at A, the angle between the target's course (W to A carried on) and the line from A to the centre: " + side(r.aspect) + ". You would see its " + lights(r.aspect).toLowerCase() + ".");
      }
      if (r.bcr) tr.push("The relative track cuts your heading line " + f1(r.bcr.range) + " NM ahead: the target crosses ahead (BCR " + f1(r.bcr.range) + " NM) in " + Math.round(r.bcr.t) + " min.");
      if (r.scr) tr.push("The relative track cuts your heading line " + f1(r.scr.range) + " NM astern: the target passes astern.");
      B.push({ h: t.fixed ? "Your ground track and the current" : "Target's course and speed (triangle W O A)", s: tr });
      if (a) {
        var ac = ["Mark P on the relative track, where the target will be at " + Radar.clock(a.m) + ": A to P = " + f1(r.rel.speed) + " × " + Math.round(a.m - r.tA) + " ÷ 60 = " + f2(r.rel.speed * (a.m - r.tA) / 60) + " NM."];
        var O2d = Math.sqrt(Math.pow(a.Vo2.x * r.dt / 60, 2) + Math.pow(a.Vo2.y * r.dt / 60, 2));
        if (o.act.type === "fc" || o.act.type === "fs") {
          ac.push("From P draw the new relative track touching the circle of radius " + f1(o.act.want) + " NM: it runs " + sh(a.rel.course) + ".",
            "Through A draw a line parallel to it, back towards W.");
          ac.push(o.act.type === "fc" ? "With W as centre and WO (" + f2(r.own.dist) + " NM, same speed) as radius, cut that line at O'. W to O' is the new course: " + both(a.course) + ", " + Math.round(Math.abs(Radar.n180(a.course - v.course))) + "° to " + (Radar.n180(a.course - v.course) >= 0 ? "starboard" : "port") + "."
            : "It cuts WO at O'. W to O' = " + f2(O2d) + " NM, so the new speed = " + f2(O2d) + " × 60 ÷ " + dt + " = " + f1(a.speed) + " kn.");
        } else {
          ac.push("From W lay off your new course " + both(a.course) + " for " + f2(O2d) + " NM (" + f1(a.speed) + " kn × " + dt + " ÷ 60): this is O'.", "Join O' to A. Through P draw a line parallel to O'A: the new relative track, " + sh(a.rel.course) + ".");
        }
        ac.push(a.passed ? "The new track leads away from the centre: the target is already opening." : "New CPA: the line from the centre at right angles to the new track, " + f1(a.cpa) + " NM, at " + a.time + ".");
        B.push({ h: "Action at " + Radar.clock(a.m), s: ac });
        if (a.resume) B.push({ h: "When to resume", s: [
          "Move along the new track from P to R, the first point from which a line parallel to O to A stays outside the " + f1(o.act.want) + " NM circle: R is " + f1(a.resume.range) + " NM, bearing " + both(a.resume.brg) + ".",
          "R is reached at " + a.resume.time + " (" + Math.round(a.resume.after) + " min after the action). Then resume " + p3(v.course) + "° and " + f1(v.speed) + " kn, and keep plotting." ] });
      }
      return B;
    }
    function stepsInto(box, r, o, rot) {
      box.innerHTML = ""; var nn = 1;
      steps(r, o, rot).forEach(function (b) { box.appendChild(el("h4", "", b.h)); var ol = el("ol"); ol.start = nn; b.s.forEach(function (s) { ol.appendChild(el("li", "", s)); nn++; }); box.appendChild(ol); });
    }

    /* ---------- print ---------- */
    function sheet(o, r, rot) {
      var v = o.v, sh = Ships.active(), d = new Date();
      fillCells($("rp-ps-info"), [["Ship", sh ? sh.name : "—"], ["Date", ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear()], ["Own course / speed", p3(v.course) + "° / " + f1(v.speed) + " kn"], ["Safe CPA", f1(v.cpa) + " NM"],
        ["Bearings", v.rel ? "Relative (head up), heading " + p3(v.heading) + "°" : "True (north up)" + (v.ge ? ", gyro error " + (v.ge > 0 ? "+" : "−") + Math.abs(v.ge) + "°" : ""), 2], ["Plot shown", "Target " + st.cur + (v.targets[st.cur].fixed ? " (fixed object)" : ""), 2]]);
      var tb = $("rp-ps-obs"); tb.innerHTML = "";
      var hr = el("tr"); ["Target", "Time", v.rel ? "Rel. bearing" : "Bearing", "Range NM"].forEach(function (h) { hr.appendChild(el("th", "", h)); }); tb.appendChild(hr);
      Object.keys(o.res).sort().forEach(function (k) { v.targets[k].obs.forEach(function (ob, j) { var tr = el("tr"); [j === 0 ? k : "", Radar.clock(Radar.minutes(ob.t)), p3(+ob.brg) + "°", f1(+ob.rng)].forEach(function (c) { tr.appendChild(el("td", "", c)); }); tb.appendChild(tr); }); });
      var rt = $("rp-ps-res"); rt.innerHTML = "";
      hr = el("tr"); ["Target", "CPA", "TCPA", "Time of CPA", "Course / speed", "Aspect", "Crossing"].forEach(function (h) { hr.appendChild(el("th", "", h)); }); rt.appendChild(hr);
      Object.keys(o.res).sort().forEach(function (k) {
        var x = o.res[k], fx = v.targets[k].fixed, pass = x.cpa.passed || x.cpa.steady, tr = el("tr");
        [k + (fx ? " (fixed)" : ""), f1(x.cpa.range) + " NM" + (pass ? " (passed)" : " " + p3(x.cpa.brg) + "°"), pass ? "—" : Math.round(x.cpa.tcpa) + " min", pass ? "—" : x.cpa.time,
          fx ? "made good " + p3(x.ground.course) + "° / " + f1(x.ground.speed) + " kn; set " + p3(x.ground.set) + "° " + f1(x.ground.drift) + " kn" : p3(x.tgt.course) + "° / " + f1(x.tgt.speed) + " kn",
          x.aspect === null ? "—" : side(x.aspect), x.bcr ? "ahead " + f1(x.bcr.range) + " NM" : x.scr ? "astern " + f1(x.scr.range) + " NM" : "—"].forEach(function (c) { tr.appendChild(el("td", "", c)); });
        rt.appendChild(tr);
      });
      var pa = $("rp-ps-act"); pa.innerHTML = "";
      if (o.act) {
        pa.appendChild(el("h3", "ps-h", "Action"));
        pa.appendChild(el("p", "", $("rp-act-verdict").textContent));
        var t2 = $("rp-act-tbl").cloneNode(true); t2.removeAttribute("id"); t2.className = "dt"; pa.appendChild(t2);
        var ul = el("ul", "rp-ps-rules"); ruleNotes(o).forEach(function (n) { ul.appendChild(el("li", "", n.t)); }); pa.appendChild(ul);
      }
      $("rp-ps-warn").textContent = (r.warn.join(" ") + " " + $("rp-verdict").textContent).trim();
      var head = "Target " + st.cur + " · " + (v.rel ? "head up" : "north up") + " · own " + p3(v.course) + "° " + f1(v.speed) + " kn";
      $("rp-ps-phead").textContent = head; $("rp-ps-dhead").textContent = head;
      $("rp-ps-plot").innerHTML = plot(r, o.act && !o.act.main.error ? o.act.main : null, v, rot, "rpb");
      $("rp-ps-key").textContent = keyHtml(r, o).replace(/<[^>]+>/g, " · ").replace(/^( · )+/, "").replace(/( · )+/g, " · ");
      stepsInto($("rp-ps-steps"), r, o, rot);
    }

    /* ---------- events ---------- */
    OWN.forEach(function (k) { $("rp-" + k).addEventListener("input", function () { st.own[k] = this.value; save(); render(); }); });
    Object.keys(ACT).forEach(function (k) { $("rp-" + k).addEventListener("input", function () { st.act[ACT[k]] = this.value; save(); render(); }); });
    ["rp-bt-true", "rp-bt-rel"].forEach(function (id) { $(id).addEventListener("change", function () { st.own.bt = $("rp-bt-rel").checked ? "rel" : "true"; save(); render(); }); });
    ["none", "fc", "fs", "me"].forEach(function (k) { $("rp-act-" + k).addEventListener("change", function () { st.act.type = k; save(); render(); }); });
    TG.forEach(function (k) { $("rp-tg-" + k).addEventListener("change", function () { st.cur = k; save(); rowsBox(); render(); }); });
    $("rp-obs-body").addEventListener("input", function (e) {
      var x = e.target, i = +x.getAttribute("data-i"), kk = x.getAttribute("data-k"), rows = st.t[st.cur].rows;
      while (rows.length <= i) rows.push({});
      rows[i][kk] = x.value; save(); render();
    });
    $("rp-obs-body").addEventListener("change", function (e) {   /* tidy a typed time 1006 to 10:06, and offer a new row when the last one is full */
      var x = e.target; if (x.getAttribute("data-k") === "t") { var m = Radar.minutes(x.value); if (m !== null) { x.value = Radar.clock(m); st.t[st.cur].rows[+x.getAttribute("data-i")].t = x.value; save(); } }
      var rows = st.t[st.cur].rows, n = $("rp-obs-body").rows.length;
      if (n < MAXR && rows.length >= n && rows[n - 1] && rows[n - 1].t && rows[n - 1].b && rows[n - 1].r) { rowsBox(); render(); }
    });
    $("rp-addrow").addEventListener("click", function () {
      var tb = $("rp-obs-body"), n = tb.rows.length; if (n >= MAXR) return;
      var rows = st.t[st.cur].rows; while (rows.length < n) rows.push({}); rows.push({}); save(); rowsBox();
      var ins = tb.querySelectorAll('input[data-k="t"]'); if (ins.length) ins[ins.length - 1].focus();
    });
    $("rp-fixed").addEventListener("change", function () { st.t[st.cur].fixed = this.checked; save(); rowsBox(); render(); });
    $("rp-at").addEventListener("change", function () { var m = Radar.minutes(this.value); if (m !== null) { this.value = Radar.clock(m); st.act.t = this.value; save(); } });
    $("rp-clear").addEventListener("click", function () {
      st.t[st.cur] = { rows: [] }; save(); rowsBox(); render(); toast("Target " + st.cur + " cleared");
    });
    $("rp-example").addEventListener("click", function () {
      st = { own: { course: "000", speed: "12", cpa: "2", bt: "true" }, cur: "A", act: { type: "fc", t: "10:18" },
        t: { A: { rows: [{ t: "10:00", b: "049", r: "11.5" }, { t: "10:06", b: "048", r: "9.6" }, { t: "10:12", b: "048", r: "7.7" }] },
             B: { rows: [{ t: "10:00", b: "297", r: "10.6" }, { t: "10:06", b: "294", r: "9.4" }, { t: "10:12", b: "289", r: "8.2" }] }, C: { rows: [] } } };
      save(); load(); render();
    });
    $("rp-print").addEventListener("click", function () { if (!last || !last.res[st.cur]) { toast("Enter the plots first"); return; } window.print(); });
    load(); render();
  }
