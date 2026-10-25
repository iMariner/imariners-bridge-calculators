"""Compare the JS sight engine with ERFA (the IAU reference library inside astropy).
usage: python3 build/sight/compare_erfa.py cases.json build/sight/cat_j2000.json   (needs astropy; cases.json from node build/sight/gen_cases.js)
Stars: GHA and Dec from ERFA atci13 (full astrometry: parallax, light bending, aberration, precession, nutation) and the Earth Rotation Angle.
Sun: astropy get_sun to CIRS.  Hc and Zn: ERFA hd2ae.  Differences in minutes of arc: GHA is multiplied by cos(dec) and Zn by cos(Hc) (true angular offsets on the sky); UTC is used as UT1 on both sides, so Earth-rotation (DUT1, up to 0.2') is not measured."""
import json, sys, math, warnings
warnings.filterwarnings('ignore')
import numpy as np, erfa
from astropy.utils import iers
iers.conf.auto_download = False
iers.conf.auto_max_age = None
from astropy.time import Time
from astropy.coordinates import get_sun, CIRS
import astropy.units as u
cases = json.load(open(sys.argv[1]))
cat = {s['n']: s for s in json.load(open(sys.argv[2]))}
D = math.pi / 180
res = {'Sun': [], 'Star': []}
for c in cases:
    t = Time(c['ms'] / 1000.0, format='unix', scale='utc')
    ut1 = (t.jd1, t.jd2)
    era = erfa.era00(*ut1)
    if c['body'] == 'Sun':
        ci = get_sun(t).transform_to(CIRS(obstime=t)); ri, di = ci.ra.rad, ci.dec.rad
    else:
        s = cat[c['body']]
        tt = t.tt
        ri, di, eo = erfa.atci13(math.radians(s['ra']), math.radians(s['de']), math.radians(s['pmra'] / 3.6e6) / math.cos(math.radians(s['de'])), math.radians(s['pmde'] / 3.6e6), s['plx'] / 1000.0, 0.0, tt.jd1, tt.jd2)
    gha = (math.degrees(era - ri)) % 360; dec = math.degrees(di)
    lha = ((gha + c['lon']) % 360) * D
    az, el = erfa.hd2ae(lha, di, c['lat'] * D)
    hc = math.degrees(el); zn = math.degrees(az)
    dg = ((c['gha'] - gha + 180) % 360 - 180) * 60 * math.cos(di)       # arc minutes on the sky
    dd = (c['dec'] - dec) * 60
    dh = (c['hc'] - hc) * 60
    dz = ((c['zn'] - zn + 180) % 360 - 180) * 60 * math.cos(math.radians(hc)) if 5 < hc < 85 else None
    res['Sun' if c['body'] == 'Sun' else 'Star'].append((dg, dd, dh, dz))
for k, v in res.items():
    a = np.array([[x if x is not None else np.nan for x in r] for r in v])
    print('%-5s n=%d' % (k, len(a)), ' | '.join('%s max %.3f rms %.3f' % (n, np.nanmax(np.abs(a[:, i])), np.sqrt(np.nanmean(a[:, i] ** 2))) for i, n in enumerate(['GHA', 'Dec', 'Hc', 'Zn*cos(h)'])), "(minutes of arc)")
