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
KIND = [('anchorage', 'an'), ('focal point', 'fp'), ('lane limit', 'll'), ('separation zone', 'sz'), ('separation line', 'sl'), ('deep water', 'dw'), ('precautionary', 'pa')]   # lane limit first: one is 'lane limit (..., separation line to inshore traffic zone)'
tss = []
for t in SR['tss']:
    pts = [ll(p) for p in t['points']]
    if max(p[0] for p in pts) < BOUNDS[0]: continue
    k = next(c for w, c in KIND if w in t['kind'])
    e = {'k': k, 's': t['scheme'], 'd': t['kind'], 'c': bool(t.get('closed')), 'p': pts, 'ids': [p.get('id', '') for p in t['points']]}
    if k == 'll':
        kd = t['kind'].replace(' bound', 'bound')     # 'south-east bound' -> 'south-eastbound'
        e['dir'] = 'W' if 'westbound' in kd else 'E' if 'eastbound' in kd else ''
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

# --- port reporting sectors (MPA PC 06/2021 Appendix 1), built like a chart: the port water (inside the port limit, off the land)
#     is cut only along the official straight lines between sector points, and each piece of water is then named.
#     An official line that ends at the coast is carried on to the land, so a point a few metres off the OSM coast still closes it.
#     Each piece is named by the sector whose rough outline (its points, the port limit where the text says so, straight lines where
#     it says "along the coastline") covers most of it; Cruise Bay (two points closed by the coast) is the small piece behind its line.
from shapely.ops import nearest_points
port_water = Polygon(limit_ring).buffer(0).difference(LAND)
cuts, rough = [], {}
def to_land(a, b):                                  # carry the line a->b on past b until it reaches land (at most 300 m)
    import math
    dx, dy = b[0] - a[0], b[1] - a[1]; n = math.hypot(dx, dy)
    if n == 0 or LAND.contains(Point(b)): return []
    for k in range(1, 61):
        e = (b[0] + dx / n * 0.00005 * k, b[1] + dy / n * 0.00005 * k)
        if LAND.contains(Point(e)): return [LineString([b, e])]
    if Point(b).distance(LAND) > 0.00045: return []  # not near the OSM coast (over 50 m): leave it; other lines close that side
    q = nearest_points(Point(b), LAND)[1]
    return [LineString([b, (q.x + (q.x - b[0]) * 0.3, q.y + (q.y - b[1]) * 0.3)])]
def to_limit(b):                                    # points the text puts on the port limit are printed 2 to 5 m off it: join them
    q = nearest_points(Point(b), limit_line)[1]
    if Point(b).distance(limit_line) > 0.0001: return []
    return [LineString([b, (q.x + (q.x - b[0]) * 2 + 1e-7, q.y + (q.y - b[1]) * 2 + 1e-7)])]
def chains(pts):                                   # the straight runs of a sector boundary, each with the "along" text before and after it
    k = max(i for i, q in enumerate(pts) if 'lat' not in q)
    seq = pts[k + 1:] + pts[:k + 1]                 # start just after an "along" entry, go once round
    out, run, before = [], [], pts[k].get('along', '').lower()
    for q in seq:
        if 'lat' in q:
            c = (q['lon'], q['lat'])
            if not run or run[-1] != c: run.append(c)
        else:
            out.append((run, before, q.get('along', '').lower())); run, before = [], q.get('along', '').lower()
    return out
for s in PT['port_reporting_sectors']:
    pts = s['points']
    for run, before, after in chains(pts):
        if len(run) < 2: continue
        cuts.append(LineString(run))
        if 'coast' in before: cuts.extend(to_land(run[1], run[0]))
        if 'coast' in after: cuts.extend(to_land(run[-2], run[-1]))
        if 'port limit' in before: cuts.extend(to_limit(run[0]))
        if 'port limit' in after: cuts.extend(to_limit(run[-1]))
    ring = []
    for i, q in enumerate(pts):
        if 'lat' in q:
            ring.append((q['lon'], q['lat']))
        elif 'port limit' in q.get('along', '') and ring:
            nxt = next((r for r in pts[i + 1:] if 'lat' in r), next(r for r in pts if 'lat' in r))
            tgt, al = (nxt['lon'], nxt['lat']), q['along']
            if 'causeway' in al.lower() and al.lower().index('port limit') < al.lower().index('causeway'):
                ring += along_limit(ring[-1], CW_W) + [CW_W]
            elif 'causeway' in al.lower():
                ring += [CW_E] + along_limit(CW_E, tgt)
            else:
                ring += along_limit(ring[-1], tgt)
    rough[s['name']] = Polygon(ring).buffer(0) if len(ring) >= 3 else None
# The Jurong Island causeway: Pasir Panjang ("along the coastline" from 6f to 6a) and West Jurong (7d to 7a) are closed by a coastline
# that only joins across this causeway, so it divides them. It is too narrow to survive the 25 m coast simplification, so its line is
# given here (Jurong Island Highway, OpenStreetMap ways 539677876, 137879901/03, 655531784/86, checked 2 Nov 2026), carried to the land.
JI_CAUSEWAY = [(103.71209, 1.29181), (103.71167, 1.29662), (103.71168, 1.29718), (103.71173, 1.30268), (103.71176, 1.30461)]
cuts += [LineString(JI_CAUSEWAY)] + to_land(JI_CAUSEWAY[1], JI_CAUSEWAY[0]) + to_land(JI_CAUSEWAY[-2], JI_CAUSEWAY[-1])
cutset = unary_union(cuts)
pieces = port_water.difference(cutset.buffer(1e-6))
pieces = [g for g in (pieces.geoms if pieces.geom_type == 'MultiPolygon' else [pieces]) if g.area > 1e-8]
cb_line = next(LineString([(q['lon'], q['lat']) for q in s['points'] if 'lat' in q]) for s in PT['port_reporting_sectors'] if s['name'].startswith('Cruise'))
cb = min([g for g in pieces if g.distance(cb_line) < 1e-5], key=lambda g: g.area)
named = {s['name']: [] for s in PT['port_reporting_sectors']}
unnamed = []
owners = {}                                         # each official segment and the sectors whose boundary lists it
for s in PT['port_reporting_sectors']:
    for run, before, after in chains(s['points']):
        for p0, p1 in zip(run, run[1:]):
            owners.setdefault(frozenset([(round(p0[0], 6), round(p0[1], 6)), (round(p1[0], 6), round(p1[1], 6))]), set()).add(s["name"])
def by_lines(g):                                    # the one sector that owns every official line along this piece, if there is one
    edge, cand = g.boundary, None
    for k, o in owners.items():
        seg = LineString(list(k)) if len(k) == 2 else None
        if seg is None or edge.intersection(seg.buffer(4e-6)).length < 0.0003: continue
        cand = set(o) if cand is None else cand & o
    return next(iter(cand)) if cand and len(cand) == 1 else None
for g in pieces:
    if g is cb: named[next(n for n in named if n.startswith('Cruise'))].append(g); continue
    n = by_lines(g)
    if n: named[n].append(g); continue
    best = max(((g.intersection(r).area if r is not None else 0, n) for n, r in rough.items()), key=lambda t: t[0])
    if best[0] > 0.5 * g.area: named[best[1]].append(g)
    else: unnamed.append(g)
print('  Cruise Bay piece', round(cb.area * 111.32 ** 2, 2), 'km2, bounds', [round(v, 4) for v in cb.bounds]); assert cb.area < 3e-4, 'Cruise Bay piece too large: %g' % cb.area
# water between an official line and the coast that no sector names (wharf basins inside the 2b-2c line): the sector beside it
for g in unnamed[:]:
    nb = [(sum(h.boundary.intersection(g.buffer(3e-6)).length for h in hs), n) for n, hs in named.items() if hs]
    best = max(nb)
    if best[0] > 0 and g.area < 5e-5:
        print('  piece by the coast at', [round(v, 4) for v in g.representative_point().coords[0]], round(g.area * 111.32 ** 2, 2), 'km2 given to', best[1])
        named[best[1]].append(g); unnamed.remove(g)
big_un = [g for g in unnamed if g.area > 2e-6]
assert not big_un, 'unnamed port water: ' + str([(round(g.representative_point().x, 4), round(g.representative_point().y, 4), g.area) for g in big_un])
sectors, polys = [], {}
for s in PT['port_reporting_sectors']:
    water = unary_union(named[s['name']]).buffer(1.2e-6).buffer(0)
    polys[s['name']] = water
    geoms = list(water.geoms) if water.geom_type == 'MultiPolygon' else [water]
    geoms = [g.simplify(0.0002, preserve_topology=True) for g in geoms if g.area > 2e-7]
    geoms = [g if g.is_valid else g.buffer(0) for g in geoms]
    lab = max(geoms, key=lambda g: g.area).representative_point()
    sectors.append({'name': s['name'], 'st': s['control_station'], 'ch': s['channel'], 'lab': [r4(lab.x), r4(lab.y)],
                    'rings': [[pack(g.exterior.coords)] + [pack(h.coords) for h in g.interiors] for g in geoms]})
names = list(polys)
for i in range(len(names)):                         # sectors must not overlap (beyond the line width)
    for j in range(i + 1, len(names)):
        ov = polys[names[i]].intersection(polys[names[j]]).area
        assert ov < 1e-7, 'sectors overlap: %s / %s %g' % (names[i], names[j], ov)
for u in PT['underway_reporting_points']:           # every underway reporting point must fall in a sector
    pt_ = Point(u['lon'], u['lat']); inn = [n for n in names if polys[n].distance(pt_) < 2e-4]
    print('  underway point', u['name'], '->', inn)
    assert inn, 'underway point outside every sector: ' + u['name']
if unnamed: print('  small unnamed slivers left out:', len(unnamed))
out['portSectors'] = sectors

out['bgs'] = [{'code': b['code'], 'name': b['name'], 'p': ll(b), 'lat': b['lat_text'], 'lon': b['lon_text'], 'use': b['use']} for b in PT['boarding_grounds']]
out['uw'] = [{'name': u['name'], 'loc': u.get('location', ''), 'p': ll(u)} for u in PT['underway_reporting_points']]
tia = PT['east_johor_strait_tia']
out['tia'] = {'p': [ll(q) for q in tia['points'] if 'lat' in q], 'ch': tia['channel'], 'st': tia['control_station']}
out['johor'] = [{'name': j['name'], 'p': [ll(q) for q in j['points'] if 'lat' in q]} for j in PT['johor']['port_limits']]

s = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
open(OUT, 'w', encoding='utf8').write(s)
print('wrote', OUT, len(s), 'bytes;', len(tss), 'TSS parts,', len(sectors), 'port sectors,', len(out['portLimit']['p']), 'port limit points')
