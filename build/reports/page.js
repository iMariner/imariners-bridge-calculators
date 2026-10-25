  /* Tool: Vessel Daily Reportings (noon reports, voyage totals, month-end distances) */
  function initDaily() {
    var KEY = "bridgeCalc.reports", all = store.get(KEY);
    if (!all || typeof all !== "object") all = {};
    var rowEls = [], undo = null, TYPES = [["cosp", "Departure"], ["noon", "Noon report"], ["eosp", "Arrival"]];
    function sk() { var s = Ships.active(); return s ? s.id : "_"; }
    function book() { var k = sk(); if (!all[k] || !Array.isArray(all[k].voyages)) all[k] = { sel: null, month: "", voyages: [] }; return all[k]; }
    function save() { store.set(KEY, all); }
    function uid() { return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function cur() { var b = book(), i; for (i = 0; i < b.voyages.length; i++) if (b.voyages[i].id === b.sel) return b.voyages[i]; return b.voyages.length ? (b.sel = b.voyages[0].id, b.voyages[0]) : null; }
    function todayStr() { var d = new Date(); return d.getFullYear() + "-" + TIME.p2(d.getMonth() + 1) + "-" + TIME.p2(d.getDate()); }
    function nextDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return todayStr(); var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)); return d.getUTCFullYear() + "-" + TIME.p2(d.getUTCMonth() + 1) + "-" + TIME.p2(d.getUTCDate()); }
    function lastZone() { var b = book(), z = ""; b.voyages.forEach(function (v) { v.rows.forEach(function (r) { if (r.zone !== "" && r.zone !== undefined) z = r.zone; }); }); return z; }
    function newRow(type, prev) {
      var now = new Date();
      return { id: uid(), type: type, date: prev ? nextDay(prev.date) : todayStr(), time: prev ? prev.time : TIME.p2(now.getHours()) + ":" + TIME.p2(now.getMinutes()), zone: prev ? prev.zone : lastZone(), dtg: type === "eosp" ? "0" : "", ovr: "", note: "" };
    }
    function newVoyage() {
      var b = book(), last = b.voyages.length ? b.voyages[b.voyages.length - 1] : null, lc = last ? (last.cond || "").trim().toLowerCase() : "";
      var v = { id: uid(), name: "Voyage " + (b.voyages.length + 1), from: last ? last.to : "", to: "", cond: lc === "loaded" ? "Ballast" : lc === "ballast" ? "Loaded" : "Loaded", rows: [] };
      v.rows.push(newRow("cosp", null)); b.voyages.push(v); b.sel = v.id; return v;
    }
    function $v(id) { return $("dr-" + id); }

    function fillSelect() {
      var b = book(), sel = $v("sel"); while (sel.firstChild) sel.removeChild(sel.firstChild);
      b.voyages.forEach(function (v) { var o = document.createElement("option"); o.value = v.id; o.textContent = (v.name || "Voyage") + (v.cond ? "  (" + v.cond + ")" : ""); sel.appendChild(o); });
      var v = cur(); if (v) sel.value = v.id;
      $v("del").disabled = !v;
    }
    function fillHeader() {
      var v = cur(), dis = !v;
      ["name", "from", "to", "cond"].forEach(function (k) { $v(k).value = v ? (v[k] || "") : ""; $v(k).disabled = dis; });
      $v("add").disabled = dis; $v("add-eosp").disabled = dis;
    }

    function mk(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
    function field(row, key, type, ph, extra) {
      var inp = mk("input"); inp.type = type; inp.value = row[key] || ""; if (ph) inp.placeholder = ph; if (type === "text") inp.setAttribute("inputmode", extra || "decimal"); inp.autocomplete = "off";
      if (key === "note") inp.maxLength = 60; else inp.maxLength = 12;
      inp.setAttribute("aria-label", key);
      inp.addEventListener("input", function () { row[key] = inp.value; save(); refresh(); });
      return inp;
    }
    function buildTable() {
      var tbl = $v("main"), v = cur(); while (tbl.firstChild) tbl.removeChild(tbl.firstChild); rowEls = [];
      var th = mk("thead"), hr = mk("tr");
      [["#", ""], ["Report", ""], ["Date", ""], ["Time", ""], ["Zone", ""], ["DTG NM", "n"], ["Run NM", "n"], ["Hours", "n"], ["Speed kn", "n"], ["Override NM", "n"], ["Voyage NM", "n"], ["Voyage time", "n"], ["Voyage avg", "n"], ["Note", ""], ["", ""]].forEach(function (h) { var c = mk("th", h[1], h[0]); hr.appendChild(c); });
      th.appendChild(hr); tbl.appendChild(th);
      var tb = mk("tbody"); tbl.appendChild(tb);
      if (!v) { var er = mk("tr"), ec = mk("td", "", "Press New voyage to start."); ec.colSpan = 15; er.appendChild(ec); tb.appendChild(er); return; }
      v.rows.forEach(function (row, i) {
        var tr = mk("tr"), els = {};
        tr.appendChild(mk("td", "", String(i + 1)));
        var tdT = mk("td", "w-type"), sel = mk("select"); sel.setAttribute("aria-label", "Report type");
        TYPES.forEach(function (t) { var o = mk("option", "", t[1]); o.value = t[0]; sel.appendChild(o); });
        sel.value = row.type; sel.addEventListener("change", function () { row.type = sel.value; save(); refresh(); }); tdT.appendChild(sel); tr.appendChild(tdT);
        var cells = [["w-date", field(row, "date", "date")], ["w-time", field(row, "time", "time")], ["w-zone", field(row, "zone", "text", "+8")], ["w-dtg", field(row, "dtg", "text", "NM")]];
        cells.forEach(function (c) { var td = mk("td", c[0]); td.appendChild(c[1]); tr.appendChild(td); });
        ["run", "hrs", "spd"].forEach(function (k) { els[k] = mk("td", "out" + (k === "spd" ? " key" : "")); tr.appendChild(els[k]); });
        var tdO = mk("td", "w-ovr"); tdO.appendChild(field(row, "ovr", "text", "")); tr.appendChild(tdO);
        ["cd", "ch", "cs"].forEach(function (k) { els[k] = mk("td", "cum"); tr.appendChild(els[k]); });
        var tdN = mk("td", "w-note"); tdN.appendChild(field(row, "note", "text", "", "text")); tr.appendChild(tdN);
        var tdX = mk("td", "del"), x = mk("button", "", "×"); x.type = "button"; x.title = "Delete this line"; x.setAttribute("aria-label", "Delete line " + (i + 1));
        x.addEventListener("click", function () { undo = { vid: v.id, index: i, row: row }; v.rows.splice(i, 1); save(); $v("undo").hidden = false; buildTable(); refresh(); });
        tdX.appendChild(x); tr.appendChild(tdX);
        els.tr = tr; rowEls.push(els); tb.appendChild(tr);
      });
    }

    var lastDone = null, curComp = null;
    function refresh() {
      var v = cur(), warns = [];
      if (!v) { ["run", "spd", "vd", "va"].forEach(function (k) { $v("h-" + k).textContent = "—"; $v("h-" + k + "-sub").textContent = ""; }); $v("line").textContent = ""; $v("copy").disabled = true; $v("warn").hidden = true; renderMonth(); return; }
      var comp = RP.compute(v.rows), tot = RP.totals(v.rows, comp); curComp = comp; lastDone = null;
      comp.forEach(function (o, i) {
        var e = rowEls[i]; if (!e) return;
        var row = v.rows[i];
        e.run.textContent = o.dist === null ? "" : (o.start ? "start" : RP.fmtDist(o.dist));
        e.hrs.textContent = o.hours === null || o.start ? "" : RP.fmtDur(o.hours).replace(/ d /, "d ").replace(/ h /, "h ").replace(/ m$/, "m");
        e.spd.textContent = o.speed === null ? "" : RP.fmtSpeed(o.speed);
        e.cd.textContent = o.done ? RP.fmtDist(o.cumDist) : ""; e.ch.textContent = o.done ? RP.fmtDur(o.cumHours).replace(/ d /, "d ").replace(/ h /, "h ").replace(/ m$/, "m") : ""; e.cs.textContent = o.done && o.cumSpeed !== null ? RP.fmtSpeed(o.cumSpeed) : "";
        e.tr.className = (o.warn ? "warn" : "") + (o.start ? " start" : "");
        e.tr.title = o.warn || "";
        var ovrIn = e.tr.querySelector(".w-ovr input"); if (ovrIn) ovrIn.placeholder = o.auto !== null && !o.start ? RP.fmtDist(o.auto) : "";
        if (o.warn) warns.push("Line " + (i + 1) + ": " + o.warn);
        if (o.done && !o.start) lastDone = { i: i, o: o, row: row };
      });
      var w = $v("warn"); w.hidden = !warns.length; w.textContent = warns.join("\n");
      if (lastDone) {
        var o = lastDone.o;
        $v("h-run").innerHTML = RP.fmtDist(o.dist) + "<small>NM</small>"; $v("h-run-sub").textContent = "in " + RP.fmtDur(o.hours) + " (" + lastDone.row.date + ")";
        $v("h-spd").innerHTML = RP.fmtSpeed(o.speed) + "<small>kn</small>"; $v("h-spd-sub").textContent = "run ÷ hours since the last report";
        $v("h-vd").innerHTML = RP.fmtDist(tot.dist) + "<small>NM</small>"; $v("h-vd-sub").textContent = "in " + RP.fmtDur(tot.hours) + " at sea";
        $v("h-va").innerHTML = RP.fmtSpeed(tot.speed) + "<small>kn</small>"; $v("h-va-sub").textContent = tot.lastDtg !== null ? "DTG now " + RP.fmtDist(tot.lastDtg) + " NM" : "";
        $v("line").textContent = lineText(v, lastDone, tot); $v("copy").disabled = false;
      } else {
        ["run", "spd", "vd", "va"].forEach(function (k) { $v("h-" + k).textContent = "—"; $v("h-" + k + "-sub").textContent = ""; });
        $v("h-run-sub").textContent = "Enter the date, time, zone and DTG of two reports."; $v("line").textContent = ""; $v("copy").disabled = true;
      }
      renderMonth();
    }
    function zoneTxt(z) { var n = RP.num(z); return n === null || isNaN(n) ? "" : " (UTC" + (n >= 0 ? "+" : "−") + Math.abs(n) + ")"; }
    function lineText(v, ld, tot) {
      var r = ld.row, o = ld.o;
      return "Noon " + r.date + " " + r.time + zoneTxt(r.zone) + " | " + (v.name || "Voyage") + (v.cond ? " " + v.cond : "") + " | DTG " + RP.fmtDist(o.dtg) + " NM | Run " + RP.fmtDist(o.dist) + " NM in " + RP.fmtDur(o.hours) + " | Avg " + RP.fmtSpeed(o.speed) + " kn | Voyage " + RP.fmtDist(tot.dist) + " NM in " + RP.fmtDur(tot.hours) + ", avg " + RP.fmtSpeed(tot.speed) + " kn";
    }

    /* month summary */
    function monthName(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym || ""); return m ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+m[2] - 1] + " " + m[1] : "—"; }
    function fillSum(tbl, head, lines, totalLine) {
      while (tbl.firstChild) tbl.removeChild(tbl.firstChild);
      var th = mk("thead"), hr = mk("tr"); head.forEach(function (h) { hr.appendChild(mk("th", "", h)); }); th.appendChild(hr); tbl.appendChild(th);
      var tb = mk("tbody"); lines.forEach(function (l, i) { var tr = mk("tr"); l.forEach(function (c) { tr.appendChild(mk("td", "", c)); }); tb.appendChild(tr); });
      if (totalLine) { var tr = mk("tr", "tot"); totalLine.forEach(function (c) { tr.appendChild(mk("td", "", c)); }); tb.appendChild(tr); }
      tbl.appendChild(tb);
    }
    var sumNow = null;
    function renderMonth() {
      var b = book(), ym = $v("month").value;
      if (!ym) { ym = b.month || ""; }
      if (!ym) { var latest = ""; b.voyages.forEach(function (v) { v.rows.forEach(function (r) { var m = RP.monthOf(r); if (m > latest) latest = m; }); }); ym = latest || todayStr().slice(0, 7); }
      if ($v("month").value !== ym) $v("month").value = ym;
      var s = RP.summary(b.voyages, ym); sumNow = { ym: ym, s: s };
      var has = s.total.reports > 0; $v("mempty").hidden = has; $v("mout").hidden = !has;
      var cl = s.groups.map(function (g) { return [g.label, RP.fmtDist(g.dist), RP.fmtDur(g.hours), RP.fmtSpeed(g.speed), String(g.reports)]; });
      var ct = ["Total", RP.fmtDist(s.total.dist), RP.fmtDur(s.total.hours), RP.fmtSpeed(s.total.speed), String(s.total.reports)];
      var vl = s.voyages.map(function (g) { return [g.name, g.cond, RP.fmtDist(g.dist), RP.fmtDur(g.hours), RP.fmtSpeed(g.speed)]; });
      fillSum($v("sum-cond"), ["Condition", "Distance NM", "Time at sea", "Avg speed kn", "Reports"], cl, ct);
      fillSum($v("sum-voy"), ["Voyage", "Condition", "Distance NM", "Time at sea", "Avg speed kn"], vl, null);
      var sh = Ships.active();
      fillCells($v("ps-info"), [["Ship", sh ? sh.name : "—"], ["IMO number", sh && sh.imo ? sh.imo : "—"], ["Month", monthName(ym)], ["Basis", "Noon reports, DTG difference"]]);
      $v("ps-dist").textContent = has ? RP.fmtDist(s.total.dist) + " NM" : "—"; $v("ps-spd").textContent = has ? RP.fmtSpeed(s.total.speed) + " kn" : "—";
      fillSum($v("ps-cond"), ["Condition", "Distance NM", "Time at sea", "Avg speed kn", "Reports"], cl, has ? ct : null);
      fillSum($v("ps-voy"), ["Voyage", "Condition", "Distance NM", "Time at sea", "Avg speed kn"], vl, null);
    }
    function sumText() {
      if (!sumNow || !sumNow.s.total.reports) return "";
      var s = sumNow.s, sh = Ships.active(), out = [(sh ? sh.name + ": " : "") + "Distance sailed in " + monthName(sumNow.ym)];
      s.groups.forEach(function (g) { out.push(g.label + ": " + RP.fmtDist(g.dist) + " NM in " + RP.fmtDur(g.hours) + ", avg " + RP.fmtSpeed(g.speed) + " kn"); });
      out.push("Total: " + RP.fmtDist(s.total.dist) + " NM in " + RP.fmtDur(s.total.hours) + ", avg " + RP.fmtSpeed(s.total.speed) + " kn");
      return out.join("\n");
    }

    function rebuild() { fillSelect(); fillHeader(); buildTable(); refresh(); }
    $v("sel").addEventListener("change", function () { book().sel = $v("sel").value; save(); undo = null; $v("undo").hidden = true; fillHeader(); buildTable(); refresh(); });
    ["name", "from", "to", "cond"].forEach(function (k) {
      $v(k).addEventListener("input", function () { var v = cur(); if (!v) return; v[k] = $v(k).value; save(); if (k === "name" || k === "cond") { var keep = $v("sel").value; fillSelect(); $v("sel").value = keep; } refresh(); });
    });
    $v("new").addEventListener("click", function () { newVoyage(); save(); undo = null; $v("undo").hidden = true; rebuild(); $v("name").focus(); $v("name").select(); });
    $v("del").addEventListener("click", function () {
      var v = cur(); if (!v) return;
      if (!window.confirm("Delete \"" + (v.name || "this voyage") + "\" and its " + v.rows.length + " report line(s)? This cannot be undone.")) return;
      var b = book(); b.voyages = b.voyages.filter(function (x) { return x.id !== v.id; }); b.sel = b.voyages.length ? b.voyages[b.voyages.length - 1].id : null; save(); undo = null; $v("undo").hidden = true; rebuild();
    });
    function addRow(type) {
      var v = cur(); if (!v) return; var prev = v.rows.length ? v.rows[v.rows.length - 1] : null;
      v.rows.push(newRow(type, prev)); save(); buildTable(); refresh();
      var last = rowEls[rowEls.length - 1]; if (last) { var inp = last.tr.querySelector(".w-dtg input"); if (inp) inp.focus(); }
    }
    $v("add").addEventListener("click", function () { addRow("noon"); });
    $v("add-eosp").addEventListener("click", function () { addRow("eosp"); });
    $v("undo").addEventListener("click", function () {
      if (!undo) return; var b = book(), v = null; b.voyages.forEach(function (x) { if (x.id === undo.vid) v = x; });
      if (v) { v.rows.splice(Math.min(undo.index, v.rows.length), 0, undo.row); save(); }
      undo = null; $v("undo").hidden = true; buildTable(); refresh();
    });
    $v("copy").addEventListener("click", function () { var v = cur(); if (v && lastDone) copyText($v("line").textContent); });
    $v("month").addEventListener("change", function () { book().month = $v("month").value; save(); renderMonth(); });
    $v("mcopy").addEventListener("click", function () { var t = sumText(); if (t) copyText(t); else toast("No completed reports in this month yet"); });
    $v("mprint").addEventListener("click", function () { renderMonth(); window.print(); });
    window.addEventListener("beforeprint", function () { if (location.hash === "#daily-reports") renderMonth(); });
    Ships.onChange(function () { if (started["daily-reports"]) { $v("month").value = ""; rebuild(); } });
    var b0 = book(); if (!b0.voyages.length) { newVoyage(); save(); }
    $v("month").value = book().month || "";
    rebuild();
  }

