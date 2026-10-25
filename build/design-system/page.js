  /* Design System page: reads the live tokens so it can never drift from the real CSS */
  function initDesign() {
    var root = document.documentElement;
    function hex(token) {
      var el = document.createElement("span"); el.style.cssText = "position:absolute;visibility:hidden;color:var(" + token + ")"; document.body.appendChild(el);
      var m = getComputedStyle(el).color.match(/[\d.]+/g) || [0, 0, 0]; document.body.removeChild(el);
      var h = "#" + [0, 1, 2].map(function (i) { return ("0" + Math.round(+m[i]).toString(16)).slice(-2); }).join("");
      return m.length > 3 && +m[3] < 1 ? h + " " + Math.round(+m[3] * 100) + "%" : h;
    }
    var GROUPS = [
      ["Roles (change with the theme)", ["--bg", "--surface", "--surface-2", "--text", "--muted", "--border", "--accent", "--accent-hover", "--accent-text", "--brand", "--heading", "--hit", "--danger", "--take", "--okc", "--header", "--header-text", "--header-muted"]],
      ["Data colours (same meaning in every tool)", ["--true", "--apparent", "--ship", "--rose", "--water", "--seabed", "--hull-top", "--hull-bottom"]],
      ["Brand palette (primitives)", ["--c-teal-50", "--c-teal-100", "--c-teal-300", "--c-teal-400", "--c-teal-500", "--c-teal-600", "--c-teal-700", "--c-teal-900", "--c-blue-400", "--c-blue-500", "--c-navy-50", "--c-navy-700", "--c-navy-900", "--c-navy-950", "--c-ink-900", "--c-ink-600", "--c-ink-400", "--c-green-600", "--c-amber-500", "--c-amber-700", "--c-red-600"]]
    ];
    function paintColors() {
      var box = $("ds-colors"); box.textContent = "";
      var th = root.getAttribute("data-theme") || "day"; $("ds-theme-note").textContent = "Showing " + th.charAt(0).toUpperCase() + th.slice(1);
      GROUPS.forEach(function (g) {
        var wrap = document.createElement("div"); wrap.className = "ds-group";
        var h = document.createElement("h3"); h.textContent = g[0]; wrap.appendChild(h);
        var grid = document.createElement("div"); grid.className = "ds-swatches";
        g[1].forEach(function (t) {
          var s = document.createElement("div"); s.className = "ds-sw";
          var c = document.createElement("div"); c.className = "ds-chip"; c.style.background = "var(" + t + ")";
          var tx = document.createElement("div"); var b = document.createElement("b"); b.textContent = t; var sp = document.createElement("span"); sp.textContent = hex(t);
          tx.appendChild(b); tx.appendChild(sp); s.appendChild(c); s.appendChild(tx); grid.appendChild(s);
        });
        wrap.appendChild(grid); box.appendChild(wrap);
      });
    }
    paintColors();
    var obs = new MutationObserver(paintColors); obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    var T = [["--fs-display", "44", "Display 088.5°"], ["--fs-4xl", "36", "Large readout 15:48"], ["--fs-3xl", "24", "Page title (h1)"], ["--fs-2xl", "20", "Input value, big figure"], ["--fs-xl", "18", "Section heading"], ["--fs-lg", "16", "Text field, lead text"], ["--fs-body", "15", "Body text throughout the app"], ["--fs-base", "14", "Buttons, secondary text"], ["--fs-md", "13", "Labels, small text, card titles"], ["--fs-data", "12.5", "Dense data tables"], ["--fs-sm", "12", "Hints and notes"], ["--fs-xs", "11", "Table heads, badges"], ["--fs-micro", "10.5", "Reason word beside a verdict"], ["--fs-2xs", "10", "Smallest: pills only"]];
    var tb = $("ds-type"); tb.textContent = "";
    var fam = document.createElement("div"); fam.className = "ds-trow"; fam.innerHTML = "<code>--font-sans</code><div class='sample' style='font-size:var(--fs-2xl)'>Open Sans: Gyro &amp; Compass Error 0123456789</div>"; tb.appendChild(fam);
    var fm = document.createElement("div"); fm.className = "ds-trow"; fm.innerHTML = "<code>--font-mono</code><div class='sample mono' style='font-size:var(--fs-lg)'>JetBrains Mono: 088.5° 15°22.4'N 0123456789</div>"; tb.appendChild(fm);
    T.forEach(function (r) {
      var row = document.createElement("div"); row.className = "ds-trow";
      var c = document.createElement("code"); c.textContent = r[0] + "  " + r[1] + "px";
      var s = document.createElement("div"); s.className = "sample"; s.style.fontSize = "var(" + r[0] + ")"; s.textContent = r[2];
      row.appendChild(c); row.appendChild(s); tb.appendChild(row);
    });
    var wts = document.createElement("div"); wts.className = "ds-trow"; wts.innerHTML = "<code>--fw-*</code><div class='sample'><span style='font-weight:var(--fw-regular)'>Regular 400</span> &nbsp; <span style='font-weight:var(--fw-medium)'>Medium 500</span> &nbsp; <span style='font-weight:var(--fw-semibold)'>Semibold 600</span> &nbsp; <span style='font-weight:var(--fw-bold)'>Bold 700</span></div>"; tb.appendChild(wts);

    var sp = $("ds-space"); sp.textContent = "";
    var rowA = document.createElement("div"); rowA.className = "ds-spaces";
    [["--sp-1", 4], ["--sp-2", 8], ["--sp-3", 12], ["--sp-4", 16], ["--sp-5", 20], ["--sp-6", 24], ["--sp-8", 32], ["--sp-10", 40]].forEach(function (s) {
      var d = document.createElement("div"); d.className = "ds-bar"; var i = document.createElement("i"); i.style.width = "var(" + s[0] + ")"; d.appendChild(i); d.appendChild(document.createTextNode(s[0] + "  " + s[1])); rowA.appendChild(d);
    });
    sp.appendChild(rowA);
    var rowB = document.createElement("div"); rowB.className = "ds-spaces"; rowB.style.marginTop = "var(--sp-5)";
    [["--r-xs", "4"], ["--r-sm", "6"], ["--r-md", "8"], ["--r-lg", "12"], ["--r-pill", "pill"]].forEach(function (s) {
      var d = document.createElement("div"); d.className = "ds-bar"; var b = document.createElement("div"); b.className = "ds-box"; b.style.borderRadius = "var(" + s[0] + ")"; d.appendChild(b); d.appendChild(document.createTextNode(s[0] + "  " + s[1])); rowB.appendChild(d);
    });
    var sh = document.createElement("div"); sh.className = "ds-bar"; var sb = document.createElement("div"); sb.className = "ds-box"; sb.style.boxShadow = "var(--shadow)"; sb.style.borderRadius = "var(--r-lg)"; sh.appendChild(sb); sh.appendChild(document.createTextNode("--shadow (Day only)")); rowB.appendChild(sh);
    sp.appendChild(rowB);

    var logo = $("brand-logo").src; $("ds-logo-a").src = logo; $("ds-logo-b").src = logo;
    $("ds-toast").addEventListener("click", function () { toast("This is a notice"); });

    var tbody = document.querySelector("#ds-tools tbody"); tbody.textContent = "";
    var nav = document.querySelectorAll(".sidenav a[data-tool-link], .sidenav h2"), group = "";
    for (var i = 0; i < nav.length; i++) {
      if (nav[i].tagName === "H2") { group = nav[i].textContent; continue; }
      var tr = document.createElement("tr"), a = document.createElement("td"), b = document.createElement("td"), c = document.createElement("td");
      a.textContent = nav[i].textContent.replace(/\s+/g, " ").trim(); b.textContent = group; c.textContent = "#" + nav[i].getAttribute("data-tool-link");
      tr.appendChild(a); tr.appendChild(b); tr.appendChild(c); tbody.appendChild(tr);
    }
  }

