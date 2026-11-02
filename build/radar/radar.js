  /* RADAR-BEGIN: radar plotting (relative plot O, A, W), CPA, TCPA, target's course and speed, aspect, bow crossing,
     action to avoid (given or found), time to resume, set and drift from a fixed object. Flat plot, own ship at the centre,
     x east, y north, NM, minutes, knots. Spec: build/radar/SPEC.md. Test: node build/radar/test_radar.js */
  var Radar = (function () {
    var R = Math.PI / 180;
    function n360(a) { a = a % 360; return a < 0 ? a + 360 : a; }
    function n180(a) { a = n360(a); return a > 180 ? a - 360 : a; }
    function vec(dir, len) { return { x: len * Math.sin(dir * R), y: len * Math.cos(dir * R) }; }
    function dirOf(v) { return n360(Math.atan2(v.x, v.y) / R); }
    function len(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
    function add(a, b, k) { k = k === undefined ? 1 : k; return { x: a.x + b.x * k, y: a.y + b.y * k }; }
    function dot(a, b) { return a.x * b.x + a.y * b.y; }
    function cross(a, b) { return a.x * b.y - a.y * b.x; }
    /* "HH:MM", "HHMM", "H:MM" or minutes; null if not a time */
    function minutes(t) {
      if (typeof t === "number") return isFinite(t) ? t : null;
      var s = String(t || "").replace(/\s/g, ""), m = /^(\d{1,2})[:.h]?(\d{2})$/.exec(s);
      if (!m || +m[1] > 24 || +m[2] > 59) return null;
      return +m[1] * 60 + +m[2];
    }
    function clock(m) { m = Math.round(m); m = ((m % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + m % 60).slice(-2); }
    /* closest distance from relative position p moving at relative velocity v (kn); t in minutes, 0 when opening */
    function closest(p, v) {
      var vv = dot(v, v); if (vv < 1e-12) return { d: len(p), t: 0, open: true, still: true };
      var t = -dot(p, v) / vv; if (t <= 0) return { d: len(p), t: 0, open: true };
      return { d: len(add(p, v, t)), t: t * 60, p: add(p, v, t), open: false };
    }
    /* SPEC case to numbers: true bearings, minutes that always go forward (past midnight adds 24 h) */
    function normalize(c) {
      var hd = c.heading === undefined || c.heading === null || c.heading === "" ? c.own.course : +c.heading, ge = +c.ge || 0, prev = null;
      var obs = c.obs.map(function (o) {
        var m = minutes(o.t); if (m === null) throw new Error("time " + o.t);
        /* past midnight only when the time is more than 12 h before the last one; a smaller step back is a plot out of order */
        while (prev !== null && m < prev - 720) m += 1440;
        if (prev !== null && m < prev) { var er = new Error("The plot times must go forward: oldest plot first."); er.user = true; throw er; }
        prev = m;
        return { m: m, b: n360(c.brgType === "rel" ? hd + +o.brg : +o.brg + ge), r: +o.rng, raw: o };
      });
      var out = { own: { course: n360(+c.own.course), speed: +c.own.speed }, obs: obs, fixed: !!c.fixed, cpaLimit: c.cpaLimit === undefined ? 2 : +c.cpaLimit };
      if (c.action) {
        var a = c.action, ta = minutes(a.t); if (ta === null) throw new Error("action time " + a.t);
        while (ta < prev - 720) ta += 1440;   /* a time a little before the last plot stays before it, so act() refuses it */
        out.action = { m: ta, course: a.course === undefined || a.course === null || a.course === "" ? null : n360(+a.course), speed: a.speed === undefined || a.speed === null || a.speed === "" ? null : +a.speed, find: a.find || null, want: a.want === undefined || a.want === null || a.want === "" ? null : +a.want };
      }
      return out;
    }
    function solve(c) {
      var obs = c.obs, O0 = obs[0], A0 = obs[obs.length - 1], dt = (A0.m - O0.m) / 60, warn = [];
      if (obs.length < 2) return { error: "At least two plots are needed." };
      if (!(dt > 0)) return { error: "The plots must be at different times." };
      var pos = obs.map(function (o) { return vec(o.b, o.r); }), O = pos[0], A = pos[pos.length - 1];
      var Vo = vec(c.own.course, c.own.speed), Vr = { x: (A.x - O.x) / dt, y: (A.y - O.y) / dt }, Vt = add(Vr, Vo), W = add(O, Vo, -dt);
      var res = { O: O, A: A, W: W, pos: pos, dt: dt * 60, tO: O0.m, tA: A0.m, Vo: Vo, Vr: Vr, Vt: Vt, warn: warn,
        rel: { course: dirOf(Vr), speed: len(Vr), dist: len(Vr) * dt }, tgt: { course: dirOf(Vt), speed: len(Vt), dist: len(Vt) * dt },
        own: { course: c.own.course, speed: c.own.speed, dist: c.own.speed * dt }, brgChange: n180(A0.b - O0.b), rngChange: A0.r - O0.r };
      /* middle plots: on the line O to A, at the right place for their time? */
      res.mid = obs.slice(1, -1).map(function (o, i) {
        var want = add(O, Vr, (o.m - O0.m) / 60), off = len({ x: pos[i + 1].x - want.x, y: pos[i + 1].y - want.y });
        return { off: off, bad: off > Math.max(0.15, 0.05 * o.r) };
      });
      if (res.mid.some(function (m) { return m.bad; })) warn.push("A middle plot is off the line O to A: the target may be altering course or speed, or a plot is wrong. Keep plotting.");
      var k = closest(A, Vr);
      if (k.still) res.cpa = { steady: true, range: len(A) };
      else if (k.open) res.cpa = { passed: true, range: len(A) };
      else res.cpa = { range: k.d, brg: dirOf(k.p), tcpa: k.t, m: A0.m + k.t, time: clock(A0.m + k.t), p: k.p };
      res.risk = !res.cpa.passed && !res.cpa.steady && res.cpa.range < c.cpaLimit;
      res.cbdr = Math.abs(res.brgChange) < 1 && res.rngChange < 0;
      res.aspect = res.tgt.speed < 0.2 || c.fixed ? null : n180(n360(A0.b + 180) - res.tgt.course);
      /* where the relative track crosses own ship's course line: ahead (BCR) or astern */
      var u = vec(c.own.course, 1), cv = cross(Vr, u); res.bcr = res.scr = null;
      if (Math.abs(cv) > 1e-9) {
        var tc = -cross(A, u) / cv;
        if (tc > 0) { var Pc = add(A, Vr, tc), d = dot(Pc, u); if (Math.abs(d) < 0.05) { /* crosses at own ship: collision, shown as CPA */ } else if (d > 0) res.bcr = { range: d, t: tc * 60, time: clock(A0.m + tc * 60), p: Pc }; else res.scr = { range: -d, t: tc * 60, time: clock(A0.m + tc * 60), p: Pc }; }
      }
      if (c.fixed) { var Vg = { x: -Vr.x, y: -Vr.y }, cur = add(Vg, Vo, -1); res.ground = { course: dirOf(Vg), speed: len(Vg), set: dirOf(cur), drift: len(cur) }; }
      if (c.action) res.action = act(c, res);
      return res;
    }
    function act(c, res) {
      var a = c.action, want = a.want !== null ? a.want : c.cpaLimit, tw = (a.m - res.tA) / 60, warn = [];
      if (tw < 0) return { error: "The action time is before the last plot." };
      var P = add(res.A, res.Vr, tw), Vt = res.Vt;
      function relFor(course, speed) { return add(Vt, vec(course, speed), -1); }
      function okFor(course, speed) { return closest(P, relFor(course, speed)).d >= want - 1e-9; }
      if (a.find && len(P) < want) return { P: P, m: a.m, want: want, warn: warn, rangeAt: len(P), brgAt: dirOf(P), error: "At " + clock(a.m) + " the target will be only " + (Math.round(len(P) * 10) / 10).toFixed(1) + " NM away, already inside " + want + " NM: no action then can give that CPA. Act at once, as much as needed." };
      var c0 = c.own.course, s0 = c.own.speed, course = a.course !== null ? a.course : c0, speed = a.speed !== null ? a.speed : s0, out = { P: P, m: a.m, want: want, warn: warn };
      if (a.find === "course") {
        var k, st = null, pt = null;
        for (k = 0; k <= 1800; k++) if (okFor(c0 + k / 10, s0)) { st = k / 10; break; }
        for (k = 0; k <= 1800; k++) if (okFor(c0 - k / 10, s0)) { pt = k / 10; break; }
        if (st !== null) { st = Math.ceil(st - 1e-9); if (!okFor(c0 + st, s0)) st++; }
        if (pt !== null) { pt = Math.ceil(pt - 1e-9); if (!okFor(c0 - pt, s0)) pt++; }
        out.stbdTurn = st; out.portTurn = pt; out.portCourse = pt === null ? null : n360(c0 - pt);
        if (st === null) return { P: P, m: a.m, want: want, warn: warn, error: "No alteration of course alone gives a CPA of " + want + " NM.", portTurn: pt, portCourse: out.portCourse };
        course = n360(c0 + st); speed = s0;
      } else if (a.find === "speed") {
        var s = okFor(c0, s0) ? s0 : null; if (s === null) for (k = Math.floor(s0 * 10 - 1e-9); k >= 0; k--) if (okFor(c0, k / 10)) { s = k / 10; break; }
        if (s === null) return { P: P, m: a.m, want: want, warn: warn, error: "Even stopping does not give a CPA of " + want + " NM: alter course as well." };
        course = c0; speed = s;
      }
      var Vr2 = relFor(course, speed), q = closest(P, Vr2);
      out.course = course; out.speed = speed; out.Vo2 = vec(course, speed); out.Vr2 = Vr2;
      out.rel = { course: dirOf(Vr2), speed: len(Vr2) };
      out.cpa = q.d; out.passed = q.open; out.tcpa = q.open ? 0 : q.t; out.time = clock(a.m + out.tcpa); out.cpaP = q.open ? P : q.p; out.cpaBrg = dirOf(out.cpaP);
      out.rangeAt = len(P); out.brgAt = dirOf(P);
      /* resume: the first moment that going back to the original course and speed keeps the target at "want" or more */
      out.resume = null;
      for (k = 0; k <= 7200; k++) {
        var Q = add(P, Vr2, k / 600);
        if (closest(Q, res.Vr).d >= want - 1e-9) { out.resume = { m: a.m + k / 10, time: clock(a.m + k / 10), after: k / 10, Q: Q, range: len(Q), brg: dirOf(Q) }; break; }
      }
      return out;
    }
    /* relative bearing of the target from own ship's head, -180..180 (+ starboard) */
    function relBrg(brg, head) { return n180(brg - head); }
    return { minutes: minutes, clock: clock, normalize: normalize, solve: solve, closest: closest, vec: vec, dirOf: dirOf, n360: n360, n180: n180, relBrg: relBrg };
  })();
  /* RADAR-END */
