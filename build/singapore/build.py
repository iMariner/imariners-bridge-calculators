# Singapore Strait chart data: packs the OSM coastline, the Straits of Malacca and Singapore routeing (TSS) in the chart area,
# STRAITREP lines and points, the Singapore port limit and port reporting sectors, pilot boarding grounds and Johor port limits
# into data/singapore.packed.json for the #singapore page.
# usage: python3 build/singapore/build.py   (needs shapely)
# Sources: data/singapore/research-straitrep.json and research-port.json (official IMO / MPA / Malaysian texts, researched 2 Nov 2026),
#          data/singapore/land-osm.json (OpenStreetMap coastline, ODbL, built by build/singapore/land.py, simplified to about 25 m).
import json, os
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import polygonize
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'data', 'singapore')
OUT = os.path.join(HERE, '..', '..', 'data', 'singapore.packed.json')
BOUNDS = [103.25, 0.90, 104.55, 1.50]

SR = json.load(open(os.path.join(DATA, 'research-straitrep.json'), encoding='utf8'))
PT = json.load(open(os.path.join(DATA, 'research-port.json'), encoding='utf8'))
LANDP = json.load(open(os.path.join(DATA, 'land-osm.json'), encoding='utf8'))
LAND = unary_union([Polygon(p[0], p[1:]) for p in LANDP]).buffer(0)

def r4(v): return round(v, 4)
def pack(ring):                                     # delta integers in 1e-4 degree
    out, px, py = [], 0, 0
    for x, y in ring:
        X, Y = int(round(x * 1e4)), int(round(y * 1e4)); out += [X - px, Y - py]; px, py = X, Y
    return out
def ll(p): return [r4(p['lon']), r4(p['lat'])]

out = {'bounds': BOUNDS, 'land': [[pack(r) for r in poly] for poly in LANDP]}

# --- TSS in the chart area (S5: MPA Singapore Port Information 2026, WGS 84; Main Strait = IMO COLREG.2/Circ.54)
KIND = [('anchorage', 'an'), ('focal point', 'fp'), ('separation zone', 'sz'), ('separation line', 'sl'), ('deep water', 'dw'), ('precautionary', 'pa'), ('lane limit', 'll')]
tss = []
for t in SR['tss']:
    pts = [ll(p) for p in t['points']]
    if max(p[0] for p in pts) < BOUNDS[0]: continue
    k = next(c for w, c in KIND if w in t['kind'])
    e = {'k': k, 's': t['scheme'], 'd': t['kind'], 'c': bool(t.get('closed')), 'p': pts, 'ids': [p.get('id', '') for p in t['points']]}
    if k == 'll':
        e['dir'] = 'W' if 'westbound' in t['kind'] or 'south-westbound' in t['kind'] else 'E' if 'eastbound' in t['kind'] or 'north-eastbound' in t['kind'] else ''
    tss.append(e)
out['tss'] = tss

# --- STRAITREP: reporting line, sector longitudes, reporting points (MPA WGS 84 where given) and reference points
rp = SR['report_points']
line = rp[0]['points']
out['sr'] = {
    'line': {'name': 'Tg Piai to Pulau Karimun Kecil', 'p': [[r4(q['lon']), r4(q['lat'])] for q in line],
             'note': 'Positions as printed in IMO MSC.73(69) para 3.3.1 (1998 datum, about 0.1\' east of WGS 84; no official WGS 84 version).'},
    'lons': [{'lon': 103 + 44.5 / 60, 'txt': "103°44.5'E", 'a': 7, 'b': 8}, {'lon': 104 + 2.1 / 60, 'txt': "104°02.1'E", 'a': 8, 'b': 9},
             {'lon': 104 + 22.9 / 60, 'txt': "104°22.9'E", 'a': 9, 'b': 0}],
    'points': [], 'refs': []}
for p in rp[1:]:
    w = p.get('wgs84') or p.get('imo')
    out['sr']['points'].append({'name': w['name'], 'p': ll(w), 'lat': w['lat_text'], 'lon': w['lon_text'], 'rep': p['report'], 'imo': p['imo']['lat_text'] + ' ' + p['imo']['lon_text'] if p.get('imo') else ''})
for q in SR['reference_points_para_3_3_3']['points']:
    w = q.get('wgs84') or q['imo']
    out['sr']['refs'].append({'n': q['n'], 'name': q['imo']['name'], 'p': ll(w), 'lat': w['lat_text'], 'lon': w['lon_text'], 'imo': q['imo']['lat_text'] + ' ' + q['imo']['lon_text']})

# --- Singapore port limit (S 215/2010, WGS 84; points 3A-3C suspended since 8 Apr 2019, so the line runs (3) to (4))
plp = [q for q in PT['port_limits']['points'] if q['n'] not in ('3A', '3B', '3C') and 'lat' in q]
limit_ring = [(q['lon'], q['lat']) for q in plp]
out['portLimit'] = {'p': [ll(q) for q in plp], 'ids': [q['n'] for q in plp]}
limit_line = LineString(limit_ring + [limit_ring[0]])
CW_W = next((q['lon'], q['lat']) for q in plp if q['n'] == '29')   # western side of the Causeway
CW_E = next((q['lon'], q['lat']) for q in plp if q['n'] == '30')   # eastern side of the Causeway

def along_limit(a, b):                              # port-limit vertices between points a and b (the shorter way round)
    da, db = limit_line.project(Point(a)), limit_line.project(Point(b)); L = limit_line.length
    coords = list(limit_line.coords)[:-1]; cum = [limit_line.project(Point(c)) for c in coords]
    fwd = [(c, d) for c, d in zip(coords, cum) if (da < d < db if da < db else d > da or d < db)]
    fwd.sort(key=lambda cd: (cd[1] - da) % L)
    bwd = list(reversed(fwd))
    span_f = (db - da) % L
    if span_f <= L / 2: return [c for c, d in fwd]
    other = [(c, d) for c, d in zip(coords, cum) if (db < d < da if db < da else d > db or d < da)]
    other.sort(key=lambda cd: (da - cd[1]) % L)
    return [c for c, d in other]

# --- port reporting sectors (MPA PC 06/2021 Appendix 1): straight lines between the points, the port limit where it says so,
#     "along the coastline" closed straight (inside land) and then the land cut away, so each sector is its water area.
sectors = []
for s in PT['port_reporting_sectors']:
    ring = []
    pts = s['points']
    for i, q in enumerate(pts):
        if 'lat' in q:
            ring.append((q['lon'], q['lat']))
        elif 'port limit' in q.get('along', '') and ring:
            nxt = next((r for r in pts[i + 1:] if 'lat' in r), next(r for r in pts if 'lat' in r))
            tgt, al = (nxt['lon'], nxt['lat']), q['along']
            if 'causeway' in al.lower() and al.lower().index('port limit') < al.lower().index('causeway'):
                ring += along_limit(ring[-1], CW_W) + [CW_W]          # West Johor Strait: port limit up to the Causeway, then the coast back (cut away with the land)
            elif 'causeway' in al.lower():
                ring += [CW_E] + along_limit(CW_E, tgt)               # East Johor Strait: coast to the Causeway, then the port limit back to the start
            else:
                ring += along_limit(ring[-1], tgt)
    if len(ring) < 3:                               # a line closed by the coast (Cruise Bay): the small bay of water the line cuts off
        from shapely.ops import polygonize
        ln = LineString(ring); area = box(*ln.buffer(0.02).bounds)
        faces = [f for f in polygonize(unary_union([ln, LAND.boundary.intersection(area), area.exterior])) if f.distance(ln) < 1e-9 and not LAND.contains(f.representative_point())]
        poly = min(faces, key=lambda f: f.area)
    else:
        poly = Polygon(ring).buffer(0)
    water = poly.difference(LAND)
    geoms = list(water.geoms) if water.geom_type == 'MultiPolygon' else [water]
    geoms = [g.simplify(0.0002) for g in geoms if g.area > 2e-7]
    lab = max(geoms, key=lambda g: g.area).representative_point()
    sectors.append({'name': s['name'], 'st': s['control_station'], 'ch': s['channel'], 'lab': [r4(lab.x), r4(lab.y)],
                    'rings': [[pack(g.exterior.coords)] + [pack(h.coords) for h in g.interiors] for g in geoms]})
out['portSectors'] = sectors

out['bgs'] = [{'code': b['code'], 'name': b['name'], 'p': ll(b), 'lat': b['lat_text'], 'lon': b['lon_text'], 'use': b['use']} for b in PT['boarding_grounds']]
out['uw'] = [{'name': u['name'], 'loc': u.get('location', ''), 'p': ll(u)} for u in PT['underway_reporting_points']]
tia = PT['east_johor_strait_tia']
out['tia'] = {'p': [ll(q) for q in tia['points'] if 'lat' in q], 'ch': tia['channel'], 'st': tia['control_station']}
out['johor'] = [{'name': j['name'], 'p': [ll(q) for q in j['points'] if 'lat' in q]} for j in PT['johor']['port_limits']]

s = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
open(OUT, 'w', encoding='utf8').write(s)
print('wrote', OUT, len(s), 'bytes;', len(tss), 'TSS parts,', len(sectors), 'port sectors,', len(out['portLimit']['p']), 'port limit points')
