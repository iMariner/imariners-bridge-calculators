#!/usr/bin/env python3
"""Make 300 random radar plotting cases (SPEC format) from known true tracks.

Usage:
  python3 gen_random.py > cases_random.json          (seeded, always the same file)
  python3 gen_random.py --check results_random.json  (compare oracle results with the truth)

Each case carries "truth": the target's true course/speed and the relative
velocity used to make the observations, so the result can be checked against
values that did not come from the plot.
"""
import json
import math
import random
import sys

SEED = 1310
N = 300


def vec(d, l):
    a = math.radians(d)
    return complex(l * math.sin(a), l * math.cos(a))


def brg(v):
    return math.degrees(math.atan2(v.real, v.imag)) % 360.0


def hhmm(m):
    m = int(round(m)) % 1440
    return "%02d:%02d" % (m // 60, m % 60)


def make(rng, i, kind):
    for _ in range(1000):
        oc = rng.choice([0, 90, 180, 270, 359]) if kind == "near000" and rng.random() < 0.3 else rng.uniform(0, 360)
        os_ = rng.uniform(0, 25)
        Vo = vec(oc, os_)
        fixed = False
        if kind == "fixed":
            fixed = True
            Vt = 0j
        elif kind == "stationary":
            Vt = 0j
        elif kind == "samevel":
            Vt = Vo
        else:
            Vt = vec(rng.uniform(0, 360), rng.uniform(0, 25))
        Vr = Vt - Vo
        rA = rng.uniform(1.0, 11.0)
        if kind == "collision":
            # place A on the relative track that passes through own ship
            if abs(Vr) < 3:
                continue
            bA = round(brg(-Vr), 1)
            A = vec(bA, rA)
            Vrel_c = vec((bA + 180.0) % 360.0, abs(Vr))   # relative track exactly through own ship
        elif kind == "near000":
            A = vec(rng.choice([359.95, 0.05, 359.5, 0.5, 0.0]) + rng.uniform(-0.04, 0.04), rA)
        else:
            A = vec(rng.uniform(0, 360), rA)
        closing = (A.real * Vr.real + A.imag * Vr.imag) < 0
        if kind == "opening" and closing:
            continue
        if kind == "normal" and not closing and rng.random() < 0.8:
            continue   # mostly approaching targets, so CPA and actions get exercised
        n_obs = 3
        gap = 6.0
        # start time; some cross midnight
        if kind == "midnight":
            t0 = rng.choice([1430, 1428, 1435, 1424, 1439])
        else:
            t0 = rng.randrange(0, 1440 - 30)
        times = [t0 + k * gap for k in range(n_obs)]
        tA = times[-1]
        pts = [A + Vr / 60.0 * (t - tA) for t in times]
        if max(abs(p) for p in pts) > 12.0 or min(abs(p) for p in pts) < 0.05:
            continue
        if kind == "near000":
            bs = [brg(p) for p in pts]
            if not any(b > 350 for b in bs) or not any(b < 10 for b in bs):
                # want bearings on both sides of north in at least one case type
                if rng.random() < 0.7:
                    continue
        break
    else:
        raise RuntimeError("could not make case %d %s" % (i, kind))

    case = {"id": "R%03d-%s" % (i, kind), "own": {"course": round(oc, 1), "speed": round(os_, 1)}}
    # use rounded own course/speed for the truth
    oc, os_ = case["own"]["course"], case["own"]["speed"]
    Vo2 = vec(oc, os_)
    if kind == "samevel":
        Vt = Vo2
    if kind == "collision":
        Vt = Vrel_c + Vo2
    Vr = Vt - Vo2
    pts = [A + Vr / 60.0 * (t - tA) for t in times]

    use_rel = rng.random() < 0.4
    ge = rng.choice([0, 0, 0, 1.5, -2.0, 0.7, -1.0])
    heading = oc
    if use_rel and rng.random() < 0.3:
        heading = round((oc + rng.uniform(-4, 4)) % 360, 1)
    case["brgType"] = "rel" if use_rel else "true"
    if use_rel:
        case["heading"] = heading
    case["ge"] = ge     # in rel cases this must be ignored (SPEC: ge on TRUE bearings only)
    obs = []
    for t, p in zip(times, pts):
        tb = brg(p)
        b = (tb - heading) % 360.0 if use_rel else (tb - ge) % 360.0
        b = round(b, 3) % 360.0
        obs.append({"t": hhmm(t), "brg": b, "rng": round(abs(p), 4)})
    if kind in ("collision", "samevel"):
        # make these exact: same displayed bearing (collision) / identical plots (Vr = 0)
        if kind == "samevel":
            for o in obs:
                o["brg"], o["rng"] = obs[-1]["brg"], obs[-1]["rng"]
        else:
            for o in obs:
                o["brg"] = obs[-1]["brg"]
    case["obs"] = obs
    case["fixed"] = fixed
    case["cpaLimit"] = rng.choice([1, 1.5, 2, 2, 3])

    if rng.random() < 0.5 or kind == "collision":
        ta = tA + rng.choice([0, 0, 3, 6])
        a = {"t": hhmm(ta)}
        mode = rng.choice(["course", "speed", "both", "findc", "findc", "finds"])
        if mode == "course":
            a["course"] = round((oc + rng.uniform(-90, 90)) % 360, 0)
        elif mode == "speed":
            a["speed"] = round(rng.uniform(0, os_), 1)
        elif mode == "both":
            a["course"] = round((oc + rng.uniform(-60, 60)) % 360, 0)
            a["speed"] = round(rng.uniform(0, 25), 1)
        elif mode == "findc":
            a["find"] = "course"
            a["want"] = rng.choice([1, 1.5, 2, 2.5, 3])
        else:
            a["find"] = "speed"
            a["want"] = rng.choice([1, 1.5, 2, 2.5, 3])
        if "want" not in a and rng.random() < 0.5:
            a["want"] = rng.choice([1, 2, 3])
        case["action"] = a

    case["truth"] = {"tgtCourse": None if abs(Vt) < 1e-9 else round(brg(Vt), 4),
                     "tgtSpeed": round(abs(Vt), 4),
                     "relCourse": None if abs(Vr) < 1e-9 else round(brg(Vr), 4),
                     "relSpeed": round(abs(Vr), 4),
                     "kind": kind}
    return case


def generate():
    rng = random.Random(SEED)
    kinds = (["normal"] * 200 + ["collision"] * 20 + ["stationary"] * 12 + ["fixed"] * 18 +
             ["samevel"] * 10 + ["opening"] * 15 + ["midnight"] * 12 + ["near000"] * 13)
    assert len(kinds) == N
    rng.shuffle(kinds)
    return [make(rng, i, k) for i, k in enumerate(kinds)]


def adiff(a, b):
    return abs((a - b + 180) % 360 - 180)


def check(results_path):
    cases = {c["id"]: c for c in generate()}
    bad = 0
    for r in json.load(open(results_path)):
        tr = cases[r["id"]]["truth"]
        if "error" in r:
            print("ERROR", r["id"], r["error"])
            bad += 1
            continue
        probs = []
        if abs(r["tgt"]["speed"] - tr["tgtSpeed"]) > 0.05:
            probs.append(("tgt speed", r["tgt"]["speed"], tr["tgtSpeed"]))
        if tr["tgtCourse"] is not None and tr["tgtSpeed"] > 0.5 and adiff(r["tgt"]["course"], tr["tgtCourse"]) > 0.2:
            probs.append(("tgt course", r["tgt"]["course"], tr["tgtCourse"]))
        if abs(r["rel"]["speed"] - tr["relSpeed"]) > 0.05:
            probs.append(("rel speed", r["rel"]["speed"], tr["relSpeed"]))
        if tr["kind"] == "collision" and r["cpa"].get("range", 9) > 0.02:
            probs.append(("collision cpa", r["cpa"]))
        if tr["kind"] == "samevel" and not r["cpa"].get("steady"):
            probs.append(("samevel", r["cpa"]))
        if tr["kind"] == "opening" and not r["cpa"].get("passed"):
            probs.append(("opening", r["cpa"]))
        if probs:
            bad += 1
            print(r["id"], probs)
    print("checked %d cases, %d with problems" % (len(cases), bad))


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--check":
        check(sys.argv[2])
    else:
        json.dump(generate(), sys.stdout, indent=1)
        sys.stdout.write("\n")
