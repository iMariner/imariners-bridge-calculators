#!/usr/bin/env python3
"""Independent checker (oracle) for the radar plotting engine.

Usage: python3 oracle.py cases.json > results.json

Implements build/radar/SPEC.md with the Python standard library only.
Vectors are complex numbers: real part = east (x), imaginary part = north (y),
in NM; velocities are in knots. Every CPA / TCPA is computed twice: closed form
and by brute-force stepping of time in 0.01 min steps, and the two must agree.
Find course / find speed / resume use their own stepping searches.
"""
import cmath
import json
import math
import sys

STEP = 0.01          # brute-force time step, minutes
BRUTE_MAX = 300000   # brute-force step cap (3000 min); beyond that only closed form is used
VR_ZERO = 1e-6       # knots: relative speed below this is "steady range"


# ---------------------------------------------------------------- helpers
def vec(direction, length):
    """Vector of `length` toward true `direction` (degrees)."""
    a = math.radians(direction)
    return complex(length * math.sin(a), length * math.cos(a))


def direction(v):
    """True direction 0..360 of vector v, or None for a zero vector."""
    if abs(v) < 1e-12:
        return None
    d = math.degrees(math.atan2(v.real, v.imag)) % 360.0
    return 0.0 if d >= 359.9999995 else d


def wrap180(a):
    a = (a + 180.0) % 360.0 - 180.0
    return 180.0 if a == -180.0 else a


def parse_hhmm(s):
    h, m = str(s).strip().split(":")
    return int(h) * 60 + float(m)


def clock(minutes):
    m = int(math.floor(minutes + 0.5)) % 1440
    return "%02d:%02d" % (m // 60, m % 60)


def r3(x):
    return None if x is None else round(x, 3)


def unwrap_times(raw):
    """Clock minutes -> continuous minutes; a time earlier than the previous one is past midnight."""
    out, day = [], 0.0
    prev = None
    for t in raw:
        v = t + day
        while prev is not None and v < prev:
            day += 1440.0
            v = t + day
        out.append(v)
        prev = v
    return out


# ---------------------------------------------------------------- CPA, two ways
def cpa_closed(P, Vr_kn):
    """Closed form. P in NM, Vr in kn. Returns (t_min or None, range). t None = steady, t<=0 = opening."""
    v = Vr_kn / 60.0
    if abs(Vr_kn) < VR_ZERO:
        return None, abs(P)
    t = -(P.real * v.real + P.imag * v.imag) / (abs(v) ** 2)
    if t <= 0:
        return t, abs(P)
    return t, abs(P + v * t)


def cpa_brute(P, Vr_kn):
    """Step time forward 0.01 min while the range keeps falling. Returns (t, range) or None if capped."""
    v = Vr_kn / 60.0
    best = abs(P)
    k = 0
    while k < BRUTE_MAX:
        r = abs(P + v * ((k + 1) * STEP))
        if r > best:
            break
        best = r
        k += 1
    else:
        return None
    # refine within the last bracket by parabola through three samples (k-1, k, k+1)
    t = k * STEP
    if k > 0:
        f = [abs(P + v * ((k + d) * STEP)) ** 2 for d in (-1, 0, 1)]
        den = f[0] - 2 * f[1] + f[2]
        if den > 0:
            t = (k + 0.5 * (f[0] - f[2]) / den) * STEP
    return t, abs(P + v * t)


def cpa_checked(P, Vr_kn, where):
    t, rng = cpa_closed(P, Vr_kn)
    if t is None:
        return t, rng
    b = cpa_brute(P, Vr_kn)
    if b is not None:
        tb, rb = b
        tc = max(t, 0.0)
        assert abs(rb - rng) < 1e-4, (where, "range", rb, rng)
        assert abs(tb - tc) < 0.02, (where, "tcpa", tb, tc)
    return t, rng


def min_future_range(Q, Vr_kn):
    t, rng = cpa_closed(Q, Vr_kn)
    return rng


def safe(P, Vr_kn, want, opening_ok=True):
    """Find course/speed test: CPA >= want, or opening (SPEC). With opening_ok False
    (resume test) the range from now on must stay >= want, so an opening target that
    is still inside `want` does not pass."""
    t, rng = cpa_closed(P, Vr_kn)
    if t is None:
        return abs(P) >= want - 1e-9
    if t <= 0:
        return True if opening_ok else abs(P) >= want - 1e-9
    return rng >= want - 1e-9


# ---------------------------------------------------------------- one case
def solve(case):
    own = case["own"]
    c0 = float(own["course"]) % 360.0
    s0 = float(own["speed"])
    Vo = vec(c0, s0)
    btype = case.get("brgType", "true")
    heading = float(case.get("heading", c0) if case.get("heading") is not None else c0)
    ge = float(case.get("ge", 0) or 0)
    fixed = bool(case.get("fixed", False))
    cpa_limit = float(case.get("cpaLimit", 2) if case.get("cpaLimit") is not None else 2)

    obs = case["obs"]
    times = unwrap_times([parse_hhmm(o["t"]) for o in obs])
    pos = []
    for o in obs:
        b = float(o["brg"])
        tb = (heading + b) % 360.0 if btype == "rel" else (b + ge) % 360.0
        pos.append(vec(tb, float(o["rng"])))
    O, A = pos[0], pos[-1]
    tO, tA = times[0], times[-1]
    dt = tA - tO
    assert dt > 0, "observation times must go forward"

    Vr = (A - O) / dt * 60.0                 # kn
    W = O - Vo * (dt / 60.0)                 # SPEC: W = O - Vo*dt
    Vt = (A - W) / dt * 60.0                 # target true velocity from WA
    assert abs(Vt - (Vr + Vo)) < 1e-9

    res = {"id": case.get("id")}
    res["rel"] = {"course": r3(direction(Vr)), "speed": r3(abs(Vr))}
    res["tgt"] = {"course": r3(direction(Vt)), "speed": r3(abs(Vt))}

    # CPA
    t, rng = cpa_checked(A, Vr, (case.get("id"), "cpa"))
    if t is None:
        res["cpa"] = {"steady": True, "range": r3(abs(A))}
    elif t <= 0:
        res["cpa"] = {"passed": True, "range": r3(abs(A))}
    else:
        pt = A + Vr / 60.0 * t
        res["cpa"] = {"range": r3(rng), "brg": r3(direction(pt)), "tcpa": r3(t), "time": clock(tA + t)}

    # Aspect
    brgA = direction(A)
    if fixed or abs(Vt) < VR_ZERO or brgA is None:
        res["aspect"] = None
    else:
        res["aspect"] = r3(wrap180((brgA + 180.0) - direction(Vt)))

    # Bow / stern crossing of own course line (original course)
    res["bcr"] = None
    res["scr"] = None
    u = vec(c0, 1.0)
    v = Vr / 60.0
    cross = lambda p: u.real * p.imag - u.imag * p.real   # u x p
    cv = cross(v)
    if abs(Vr) >= VR_ZERO and abs(cv) > 1e-12:
        tx = -cross(A) / cv
        if tx > 0:
            X = A + v * tx
            # independent check: the cross product changes sign around tx
            e = 1e-3
            s1, s2 = cross(A + v * (tx - e)), cross(A + v * (tx + e))
            assert s1 * s2 <= 0 or abs(cross(X)) < 1e-9, (case.get("id"), "bcr sign")
            along = X.real * u.real + X.imag * u.imag
            entry = {"range": r3(abs(along)), "t": r3(tx)}
            if along >= -1e-9:   # through own ship (collision) counts as a bow crossing at 0
                res["bcr"] = entry
            else:
                res["scr"] = entry

    # Fixed object
    if fixed:
        Vg = -Vr
        cur = Vg - Vo
        res["ground"] = {"course": r3(direction(Vg)), "speed": r3(abs(Vg)),
                         "set": r3(direction(cur)), "drift": r3(abs(cur))}

    # Action
    act = case.get("action")
    if act:
        ta = parse_hhmm(act["t"])
        while ta < tA - 1e-9:
            ta += 1440.0
        P = A + Vr / 60.0 * (ta - tA)
        want = act.get("want")
        want_eff = float(want) if want is not None else cpa_limit
        find = act.get("find")
        nc = float(act["course"]) % 360.0 if act.get("course") is not None else c0
        ns = float(act["speed"]) if act.get("speed") is not None else s0
        out = {}

        def vr_new(course, speed):
            return Vt - vec(course, speed)

        if find == "course":
            ns = s0

            def first_ok(sign):
                # 0.1 degree steps 0.0 .. 180.0
                for k in range(0, 1801):
                    a = k / 10.0
                    if safe(P, vr_new((c0 + sign * a) % 360.0, ns), want_eff):
                        n = int(math.ceil(a - 1e-9))
                        while n <= 180:
                            if safe(P, vr_new((c0 + sign * n) % 360.0, ns), want_eff):
                                return n
                            n += 1
                        return None
                return None
            ns_alt = first_ok(+1)
            np_alt = first_ok(-1)
            out["stbdAlt"] = ns_alt
            out["portAlt"] = np_alt
            out["portCourse"] = None if np_alt is None else r3((c0 - np_alt) % 360.0)
            nc = None if ns_alt is None else (c0 + ns_alt) % 360.0
        elif find == "speed":
            nc = c0
            found = None
            if safe(P, vr_new(c0, s0), want_eff):
                found = s0
            else:
                k = 1
                while True:
                    s = round(s0 - k * 0.1, 6)
                    if s < -1e-9:
                        break
                    s = max(s, 0.0)
                    if safe(P, vr_new(c0, s), want_eff):
                        found = s
                        break
                    k += 1
            ns = found

        out["course"] = r3(nc)
        out["speed"] = r3(ns)
        if nc is not None and ns is not None:
            Vr2 = vr_new(nc, ns)
            out["relCourse"] = r3(direction(Vr2))
            out["relSpeed"] = r3(abs(Vr2))
            t2, rng2 = cpa_checked(P, Vr2, (case.get("id"), "action cpa"))
            if t2 is None:
                out.update({"cpa": r3(abs(P)), "tcpa": None, "time": None, "steady": True})
            elif t2 <= 0:
                out.update({"cpa": r3(abs(P)), "tcpa": None, "time": None, "passed": True})
            else:
                pt2 = P + Vr2 / 60.0 * t2
                out.update({"cpa": r3(rng2), "brg": r3(direction(pt2)), "tcpa": r3(t2),
                            "time": clock(ta + t2)})
            # Resume original course and speed: earliest 0.1 min step after the action
            resume = None
            for k in range(1, 14401):
                tr = k / 10.0
                Q = P + Vr2 / 60.0 * tr
                if safe(Q, Vr, want_eff, opening_ok=False):
                    resume = tr
                    break
            if resume is not None:
                Q = P + Vr2 / 60.0 * resume
                b = cpa_brute(Q, Vr)
                if b is not None:
                    assert b[1] >= want_eff - 1e-3, (case.get("id"), "resume brute", b, want_eff)
                out["resume"] = {"t": r3(resume), "time": clock(ta + resume)}
            else:
                out["resume"] = None
        else:
            out.update({"cpa": None, "tcpa": None, "time": None, "resume": None})
        if find != "course":
            out.setdefault("portCourse", None)
        res["action"] = out
    return res


def main():
    with open(sys.argv[1]) as f:
        cases = json.load(f)
    results = []
    for c in cases:
        try:
            results.append(solve(c))
        except AssertionError as e:
            results.append({"id": c.get("id"), "error": "assert: %r" % (e,)})
    json.dump(results, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
