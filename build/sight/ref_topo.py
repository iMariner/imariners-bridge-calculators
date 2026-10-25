"""Topocentric altitude and azimuth of the Moon from DE440 (astropy AltAz, no refraction), for testing Sight.reduceBody.
usage: python3 ref_topo.py de440s.bsp out.json [n]"""
import json, sys, math, random, warnings
warnings.filterwarnings('ignore')
from astropy.utils import iers
iers.conf.auto_download = False; iers.conf.auto_max_age = None
from astropy.time import Time
from astropy.coordinates import get_body, AltAz, EarthLocation, solar_system_ephemeris
import astropy.units as u
bsp, out = sys.argv[1], sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 200
random.seed(11); rows = []
with solar_system_ephemeris.set(bsp):
    while len(rows) < n:
        ms = random.uniform(1735689600000, 2871763200000); lat = random.uniform(-70, 70); lon = random.uniform(-180, 180)
        t = Time(ms / 1000.0, format='unix', scale='utc'); loc = EarthLocation.from_geodetic(lon * u.deg, lat * u.deg, 0 * u.m)
        aa = get_body('moon', t, location=loc).transform_to(AltAz(obstime=t, location=loc, pressure=0))
        if aa.alt.deg < 3: continue
        rows.append({'ms': ms, 'lat': lat, 'lon': lon, 'hc': aa.alt.deg, 'zn': aa.az.deg})
json.dump(rows, open(out, 'w')); print('wrote', len(rows))
