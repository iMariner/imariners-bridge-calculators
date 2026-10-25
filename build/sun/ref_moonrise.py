"""Moonrise and moonset from JPL DE440 (astropy + jplephem): the time the Moon's upper limb is on the sea-level horizon
(topocentric centre altitude = -34' refraction - topocentric semi-diameter). usage: python3 ref_moonrise.py de440s.bsp out.json [n]"""
import json, sys, math, random, warnings
warnings.filterwarnings('ignore')
from astropy.utils import iers
iers.conf.auto_download = False; iers.conf.auto_max_age = None
from astropy.time import Time
from astropy.coordinates import get_body, AltAz, EarthLocation, solar_system_ephemeris
import astropy.units as u
bsp, out = sys.argv[1], sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 30
random.seed(5); rows = []
def f(ms, loc):
    t = Time(ms / 1000.0, format='unix', scale='utc')
    c = get_body('moon', t, location=loc).transform_to(AltAz(obstime=t, location=loc, pressure=0))
    sd = math.degrees(math.asin(1737.4 / c.distance.to(u.km).value))
    return c.alt.deg + 34 / 60 + sd
with solar_system_ephemeris.set(bsp):
    while len(rows) < n:
        lat = random.uniform(-60, 60); lon = random.uniform(-180, 180); day = random.randint(0, 365 * 30)
        start = 1767225600000 + day * 86400000; loc = EarthLocation.from_geodetic(lon * u.deg, lat * u.deg, 0 * u.m)
        t0 = start; f0 = f(t0, loc); ev = []
        for k in range(1, 145):                      # 10-minute steps over 24 h
            t1 = start + k * 600000; f1 = f(t1, loc)
            if (f0 < 0) != (f1 < 0):
                a, b, fa = t0, t1, f0
                for _ in range(30):
                    m = (a + b) / 2; fm = f(m, loc)
                    if (fm < 0) == (fa < 0): a, fa = m, fm
                    else: b = m
                ev.append({'ms': (a + b) / 2, 'rise': bool(f1 >= 0)})
            t0, f0 = t1, f1
        rows.append({'lat': lat, 'lon': lon, 'start': start, 'events': ev})
json.dump(rows, open(out, 'w')); print('wrote', len(rows), 'days,', sum(len(r['events']) for r in rows), 'events')
