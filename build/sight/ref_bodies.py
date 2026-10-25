"""Reference positions for the Moon and planets from JPL DE440 (via astropy + jplephem), for testing the JS engine.
usage: python3 build/sight/ref_bodies.py /path/to/de440s.bsp out.json [n]
For random UTC instants 2000-2060: GHA = Earth Rotation Angle - CIRS right ascension (UTC used as UT1, as in the JS engine),
Dec, and geocentric distance (km). Apparent places: light time, aberration, light bending, precession-nutation (IAU 2006/2000A)."""
import json, sys, math, random, warnings
warnings.filterwarnings('ignore')
import erfa
from astropy.utils import iers
iers.conf.auto_download = False; iers.conf.auto_max_age = None
from astropy.time import Time
from astropy.coordinates import get_body, CIRS, solar_system_ephemeris
import astropy.units as u
bsp, out = sys.argv[1], sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 400
random.seed(7); rows = []
with solar_system_ephemeris.set(bsp):
    for i in range(n):
        ms = random.uniform(946684800000, 2871763200000)            # 2000-01-01 .. 2061-01-01
        t = Time(ms / 1000.0, format='unix', scale='utc')
        era = erfa.era00(t.jd1, t.jd2)
        for body in ['sun', 'moon', 'venus', 'mars', 'jupiter', 'saturn']:
            c = get_body(body, t).transform_to(CIRS(obstime=t))
            rows.append({'ms': ms, 'body': body, 'gha': math.degrees(era - c.ra.rad) % 360, 'dec': c.dec.deg, 'km': c.distance.to(u.km).value})
json.dump(rows, open(out, 'w'))
print('wrote', len(rows))
