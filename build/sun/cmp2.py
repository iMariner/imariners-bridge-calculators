import json,warnings,statistics
warnings.filterwarnings('ignore')
from astropy.time import Time
from astropy.coordinates import get_sun, EarthLocation, AltAz, solar_system_ephemeris
import astropy.units as u, numpy as np
from astropy.utils import iers
iers.conf.auto_download=False
iers.conf.auto_max_age=None
try:
    iers.conf.iers_degraded_accuracy='ignore'
except Exception: pass
solar_system_ephemeris.set('builtin')
import time as _t; T0=_t.time()
out=json.load(open('js_out.json'))
rows=[]
for o in out:
    c=o['c'];r=o['r']
    loc=EarthLocation(lat=c['lat']*u.deg,lon=c['lon']*u.deg,height=0)
    for lv in ['sun','civil','nautical','astro']:
        L=r['levels'][lv];h0=L['h0']
        for kind in ['rise','set']:
            for t in L[kind]:
                ms=t+np.arange(-600,601,5)*1000.0   # +-10 min at 5 s
                tt=Time(ms/1000.0,format='unix')
                alt=get_sun(tt).transform_to(AltAz(obstime=tt,location=loc,pressure=0)).alt.deg-h0
                idx=np.where(np.sign(alt[:-1])!=np.sign(alt[1:]))[0]
                if not len(idx): rows.append((abs(c['lat']),lv,kind,None));continue
                i=idx[0];x=ms[i]+(0-alt[i])/(alt[i+1]-alt[i])*(ms[i+1]-ms[i])
                rows.append((abs(c['lat']),lv,kind,(t-x)/1000.0))
ok=[r for r in rows if r[3] is not None];miss=[r for r in rows if r[3] is None]
print('events',len(rows),'no crossing in astropy window',len(miss))
for lo,hi in ((0,30),(30,50),(50,60),(60,90)):
    d=[abs(r[3]) for r in ok if lo<=r[0]<hi]
    if d: print('lat',lo,hi,'n',len(d),'median',round(statistics.median(d),1),'max',round(max(d),1))
print('worst',sorted(ok,key=lambda r:-abs(r[3]))[:4])

print('seconds',round(_t.time()-T0))
