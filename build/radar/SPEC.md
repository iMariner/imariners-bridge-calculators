# Radar Plotting: engine spec (shared by the app engine and the independent checker)

Flat plot, own ship at the centre, x = east, y = north, distances in NM, times in minutes, speeds in knots.
Directions are true, 000-360, clockwise from north. Assume own ship's and target's true velocities are constant
between observations, and alterations are instant (no turning circle, no speed lag).

## Input case (JSON)
```
{ "id": "any",
  "own": { "course": 000, "speed": 12 },          // own ship's course and speed (through the water)
  "brgType": "true" | "rel",                      // true bearings, or relative to the ship's head (head-up radar)
  "heading": 000,                                 // own heading for relative bearings (default = own.course)
  "ge": 0,                                        // gyro error, E +, W -, added to TRUE bearings only (true = gyro + ge)
  "obs": [ { "t": "HH:MM", "brg": 0, "rng": 0 } ...],   // 2 or more; times go forward; past midnight adds 24 h
  "fixed": false,                                 // true = the target is a fixed object (buoy, light, land)
  "cpaLimit": 2,                                  // safe CPA in NM
  "action": { "t": "HH:MM",                       // time of own ship's action (optional block)
              "course": 000, "speed": 12,         // the new course and speed (either or both; missing = unchanged)
              "find": "course" | "speed",         // optional: find the smallest starboard alteration / speed reduction
              "want": 2 }                         //   that gives CPA >= want NM (find overrides course/speed above)
}
```
Relative bearing r becomes true: (heading + r) mod 360. A true bearing b becomes (b + ge) mod 360.

## Method (the relative plot O, A, W)
- O = first observation, A = last observation (position of the target relative to own ship), dt = tA - tO.
- Relative velocity Vr = (A - O) / dt. Relative course = direction of OA, relative speed = |OA| / dt.
- W = O - Vo * dt (Vo = own true velocity). Target true velocity Vt = Vr + Vo; target course/speed from WA.
- CPA: from A, time t* = -(A . Vr) / |Vr|^2. If t* > 0: CPA = |A + Vr t*|, bearing of that point from own ship,
  TCPA = t* (minutes after A), time of CPA = tA + t*. If t* <= 0 the target is opening: CPA "passed",
  current range is the closest. Vr = 0: range steady, no CPA.
- Aspect: angle between the target's heading (its true course) and the line from the target to own ship
  (bearing of own ship from the target = bearing of target + 180), -180..180, negative = Red (own ship on the
  target's port side), positive = Green.
- Bow crossing: where the relative track (A + Vr t, t > 0) crosses own ship's course line (the line through
  own ship along own course). Ahead (dot with own course > 0): BCR = that distance ahead, BCT = t (minutes after A).
  Astern: stern crossing range SCR and time. No crossing: null.
- Fixed object: Vt is the ground track error; the object is not moving, so own ground velocity Vg = -Vr,
  ground course/speed from Vg, and the current (set and drift) = Vg - Vo.

## Action
- P = target relative position at the action time = A + Vr (ta - tA) (ta >= tA).
- New own velocity Vo' from the new course/speed. New relative velocity Vr' = Vt - Vo'.
- New CPA and TCPA from P with Vr', TCPA counted from the action time, also given as the clock time.
- find "course": the smallest alteration to STARBOARD (in 0.1 degree steps, then reported to the nearest whole
  degree that achieves it) with the closest distance from now on >= want (an opening target counts at its present
  range, so a target already inside `want` has no answer; decided after the independent check, 2 Nov 2026). Also report the smallest
  alteration to port that does it.
- find "speed": the largest new speed below the current one (0.1 kn steps) with CPA >= want; null if even 0 kn fails.
- Resume: the earliest time (0.1 min steps) after the action at which going back to the ORIGINAL course and speed
  keeps the target at or beyond `want` (or cpaLimit if no want) for all later time.

## Output (JSON, same id)
```
{ "id", "rel": {"course","speed"}, "tgt": {"course","speed"},
  "cpa": {"range","brg","tcpa","time"} | {"passed": true, "range"},
  "aspect": deg, "bcr": {"range","t"} | null, "scr": {"range","t"} | null,
  "ground": {"course","speed","set","drift"} (fixed only),
  "action": {"cpa","tcpa","time","course","speed","portCourse","resume"} }
```
Tolerances for comparison: courses 0.2 degree, speeds 0.05 kn, ranges 0.02 NM, times 0.2 min.
