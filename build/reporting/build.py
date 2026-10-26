"""Pack data/reporting/*.json (one record per reporting system, format in data/reporting/SCHEMA.md) into data/reporting.packed.json for the page.
usage:  python build/reporting/build.py <ne_10m_land.geojson> <cache dir for Marine Regions downloads>
needs:  shapely, numpy (Natural Earth 10m land: raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson)

Areas
- polygon: the official points, exactly, as one ring (no coast cut: crossings are then on the official edges only).
- lines:   water inside the bbox is split by the official lines (extended a little onto land); the piece holding inside_hint is the area.
           The coast part of the ring is simplified, the official line vertices are kept exactly.
- territorial-sea / eez: the polygon from Marine Regions (Flanders Marine Institute, CC BY 4.0), downloaded once into the cache.
           Marked rgs = "derived": drawn dashed, labelled not official.
- circle:  drawn by the page from centre and radius.  port / global: no area."""
import json, glob, math, os, re, sys, urllib.request, urllib.parse
from shapely.geometry import shape, box, Polygon, LineString, Point, MultiPolygon, mapping
from shapely.ops import unary_union, transform, split
from shapely.strtree import STRtree
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
LAND_FILE, CACHE = sys.argv[1], sys.argv[2]
os.makedirs(CACHE, exist_ok=True)

RX = re.compile(r"^\s*(\d+(?:\.\d+)?)(?:[\s°]+(\d+(?:\.\d+)?))?(?:['\s]+(\d+(?:\.\d+)?))?[\s'\"]*([NSEW])\s*$")
def parse(s):
    m = RX.match(str(s).replace(',', '.'))
    if not m: raise ValueError('bad coordinate %r' % s)
    v = float(m[1]) + (float(m[2]) / 60 if m[2] else 0) + (float(m[3]) / 3600 if m[3] else 0)
    return -v if m[4] in 'SW' else v
def merc(lat): lat = max(min(lat, 85.0), -85.0); return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))
def proj(g): return transform(lambda x, y, z=None: (x, np.degrees(np.log(np.tan(np.pi / 4 + np.radians(np.clip(y, -85, 85)) / 2)))), g)
def unproj(g): return transform(lambda x, y, z=None: (x, np.degrees(2 * np.arctan(np.exp(np.radians(y))) - np.pi / 2)), g)

print('loading land ...', file=sys.stderr)
polys = []
for f in json.load(open(LAND_FILE))['features']:
    g = shape(f['geometry'])
    polys.extend(g.geoms if g.geom_type == 'MultiPolygon' else [g])
tree = STRtree(polys)
def land_in(bb):
    b = box(*bb); parts = [polys[i].intersection(b) for i in tree.query(b)]; parts = [p for p in parts if not p.is_empty]
    return proj((unary_union(parts) if parts else Polygon()).buffer(0))

COAST = 0.08   # degrees (about 5 NM): land this close to an area is counted in it, so a port that plots on the land of a small-scale coast is still 'inside'
def with_coast(g, bb):
    strip = land_in(bb).intersection(g.buffer(COAST))
    u = g.union(strip).buffer(0)
    if hasattr(u, 'geoms'): u = max(u.geoms, key=lambda x: x.area)
    return Polygon(u.exterior)
WITHIN = {'ru-vts-vladivostok-sector-1a': ['eez_12nm:49031', 'eez_internal_waters:49485'], 'ru-vts-peter-great-bay-sector-1b': ['eez_12nm:49031', 'eez_internal_waters:49485']}
def lines_area(rec, pts):
    a = rec['area']; bb = list(a['bbox']); bb = [bb[0] - 0.25, bb[1] - 0.25, bb[2] + 0.25, bb[3] + 0.25]   # room so the coast, not the box, closes the area
    water = box(bb[0], merc(bb[1]), bb[2], merc(bb[3])).difference(land_in(bb))
    P = lambda n: (pts[n][0], merc(pts[n][1]))
    official = set()
    for seq in a.get('lines', []):
        c = [P(n) for n in seq if n in pts]
        if len(c) < 2: continue
        official.update(c)
        def push(p, q, dd=0.6): dx, dy = p[0] - q[0], p[1] - q[1]; n = math.hypot(dx, dy) or 1; return (p[0] + dx / n * dd, p[1] + dy / n * dd)
        line = LineString(c if c[0] == c[-1] else [push(c[0], c[1])] + c + [push(c[-1], c[-2])])
        pieces = []
        for w in (water.geoms if hasattr(water, 'geoms') else [water]):
            if w.geom_type == 'Polygon': pieces.extend(g for g in split(w, line).geoms if g.geom_type == 'Polygon')
        water = MultiPolygon(pieces)
    if water.geom_type == 'Polygon': water = MultiPolygon([water])
    h = Point(a['inside_hint']['lon'], merc(a['inside_hint']['lat']))
    piece = next((g for g in water.geoms if g.buffer(1e-9).contains(h)), None)
    if piece is None: raise ValueError('inside_hint is not in any piece of water')
    clip = WITHIN.get(rec['id'])
    if clip:                                            # e.g. 'bounded to the south by the outer limit of the territorial sea'
        ts = proj(unary_union([mr_get(x.split(':')[0], int(x.split(':')[1]))[0] for x in clip]).buffer(0)).union(land_in(bb))
        piece = piece.intersection(ts)
        piece = max(piece.geoms, key=lambda g: g.area) if hasattr(piece, 'geoms') else piece
    piece = with_coast(piece, bb)
    pb = piece.bounds; touch = [n for n, v, w in (('W', pb[0], bb[0]), ('S', pb[1], merc(bb[1])), ('E', pb[2], bb[2]), ('N', pb[3], merc(bb[3]))) if abs(v - w) < 1e-6]
    if touch: print('WARNING %s: the area reaches the %s edge of its bbox (do the lines end on the coast? is the bbox big enough?)' % (rec['id'], '/'.join(touch)), file=sys.stderr)
    ring = list(piece.exterior.coords)
    keep = [i for i, c in enumerate(ring) if min((abs(c[0] - o[0]) + abs(c[1] - o[1]) for o in official), default=9) < 1e-7]
    out, last = [], 0                                   # simplify the coast between official vertices only
    marks = sorted(set([0] + keep + [len(ring) - 1]))
    for i0, i1 in zip(marks, marks[1:]):
        seg = ring[i0:i1 + 1]
        if i0 in keep and i1 in keep and i1 == i0 + 1: out.extend(seg[:-1]); continue
        s = list(LineString(seg).simplify(0.003).coords) if len(seg) > 2 else seg
        out.extend(s[:-1])
    out.append(ring[-1])
    return [[(x, math.degrees(2 * math.atan(math.exp(math.radians(y))) - math.pi / 2)) for x, y in out]], 'official lines, coast simplified'

MR = 'https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json&typeName=MarineRegions:'
def mr_get(layer, mrgid):
    fn = os.path.join(CACHE, '%s-%s.geojson' % (layer, mrgid))
    if not os.path.exists(fn):
        url = MR + layer + '&CQL_FILTER=' + urllib.parse.quote('mrgid=%d' % mrgid)
        print('download', url, file=sys.stderr)
        with urllib.request.urlopen(url, timeout=180) as r: open(fn, 'wb').write(r.read())
    fc = json.load(open(fn))
    if not fc.get('features'): raise ValueError('Marine Regions has no %s %s' % (layer, mrgid))
    return unary_union([shape(f['geometry']) for f in fc['features']]), fc['features'][0]['properties'].get('geoname')
MR_IDS = {     # record id -> Marine Regions ids (territorial sea + internal waters), when the record itself has no area.mr
    'surnav-manche-atlantique': ['eez_12nm:49018', 'eez_internal_waters:49476'], 'surnav-mediterranee': ['eez_12nm:49018', 'eez_internal_waters:49476'],
    'surnav-antilles': ['eez_12nm:49224', 'eez_internal_waters:49556', 'eez_12nm:49225', 'eez_internal_waters:49557', 'eez_12nm:49207', 'eez_internal_waters:49555', 'eez_12nm:49231', 'eez_internal_waters:49558'],
    'surnav-guyane': ['eez_12nm:49176', 'eez_internal_waters:49531'], 'surnav-reunion-mayotte': ['eez_12nm:49063'], 'surnav-reunion': ['eez_12nm:49063'],
    'surnav-nouvelle-caledonie': ['eez_12nm:49042', 'eez_internal_waters:49489'], 'surnav-polynesie': ['eez_12nm:49155', 'eez_internal_waters:49526'],
    'surnav-saint-pierre-miquelon': ['eez_12nm:49206', 'eez_internal_waters:49554'],
    'jp-foreign-ships-ts': ['eez_12nm:49201', 'eez_internal_waters:49550'],
    'cn-territorial-sea-report': ['eez_12nm:49200', 'eez_internal_waters:49549'],
}
NO_AREA = {'cn-internal-waters-emergency'}   # only for an emergency entry: listed, but not put on every route into the Bohai
RU_TS = ['eez_12nm:49031', 'eez_internal_waters:49485']
def derived_area(rec):
    a = rec['area']; layer0 = 'eez_12nm' if a['shape'] == 'territorial-sea' else 'eez'
    ids = a.get('mr') or MR_IDS.get(rec['id']) or []          # 'layer:mrgid', or a bare mrgid in the default layer
    if not ids: raise ValueError('no Marine Regions id (area.mr) for %s' % rec['id'])
    geoms, names = [], []
    for i in ids:
        layer, mid = (str(i).split(':') + [None])[:2] if ':' in str(i) else (layer0, i)
        g, nm = mr_get(layer, int(mid)); geoms.append(g); names.append(nm)
    layer = layer0
    g = unary_union(geoms).buffer(0)
    bb = a.get('bbox') or list(g.bounds)
    g = proj(g.intersection(box(bb[0], bb[1], bb[2], bb[3])))
    strip = land_in(bb).intersection(g.buffer(COAST))
    g = g.union(strip).buffer(0).simplify(0.002, preserve_topology=True)
    rings = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type != 'Polygon' or p.is_empty or p.area < 1e-5: continue
        rings.append([(x, math.degrees(2 * math.atan(math.exp(math.radians(y))) - math.pi / 2)) for x, y in p.exterior.coords])
    return rings, 'derived: Marine Regions ' + layer + ' (' + ', '.join(n for n in names if n) + '), CC BY 4.0'

def enc(ring):
    xs = [round(c[0] * 10000) for c in ring]; ys = [round(c[1] * 10000) for c in ring]; out = [xs[0], ys[0]]
    for i in range(1, len(xs)): out += [xs[i] - xs[i - 1], ys[i] - ys[i - 1]]
    return out

# Which standard item each report line is, so the page can fill it in. Systems on the IMO A.851(20) letters: the letter itself.
# Systems with their own letters (SURNAV La Reunion A to S, New Caledonia A to H ...): read from the line's wording; unknown -> no autofill.
KEYS = [('Z', r'end of (the )?(report|message)'), ('H', r'(point|time).{0,40}entry|entering|entry into'), ('K', r'exit|leaving|arrival at the (destination|port)'),
        ('B', r'^date and time|six digits|dd ?hh ?mm'), ('A', r"ship'?s name|name of (the )?ship|nationality|call sign"), ('C', r'^position'), ('E', r'^course|true course'),
        ('F', r'^speed'), ('G', r'port of departure|where from|last port'), ('I', r'destination|eta'), ('Q', r'defects|damage|deficienc|failure|manoeuvring'), ('M', r'radio'), ('O', r'^draught'),
        ('P', r'cargo|dangerous or polluting goods|hazardous'), ('Q', r'defects|damage|deficienc'), ('S', r'weather'), ('W', r'persons on board'),
        ('U', r'type of ship|ship size|main particulars'), ('T', r'agent|owner'), ('X', r'remarks|miscellaneous')]
def std_letter(rec, l):
    own = re.search(r'not the imo|own letters|own consecutive letters', (rec.get('format_note') or ''), re.I)
    if not own: return l.get('l')
    t = (l.get('text') or '').strip().lower()
    for k, rx in KEYS:
        if re.search(rx, t): return k
    return None
GROUPS = ['Russia, Far East', 'China', 'Korea', 'Japan', 'France: SURNAV', 'Europe and Mediterranean (IMO)', 'Americas (IMO)', 'Asia, Pacific and Africa (IMO)', 'Other']
def group(r):
    p = r['id'].split('-')[0]
    if p in ('ru',): return 'Russia, Far East'
    if p == 'cn' or r['id'] == 'imo-chengshantou': return 'China'
    if p == 'kr': return 'Korea'
    if p == 'jp': return 'Japan'
    if p == 'surnav': return 'France: SURNAV'
    if p == 'imo':
        bb = (r.get('area') or {}).get('bbox') or [0, 0, 0, 0]; lo, la = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        if -35 <= lo <= 50 and la > 25: return 'Europe and Mediterranean (IMO)'
        if lo < -30: return 'Americas (IMO)'
        return 'Asia, Pacific and Africa (IMO)'
    return 'Other'

out, report = [], []
SRC = os.environ.get('SR_DATA') or os.path.join(ROOT, 'data', 'reporting')   # SR_DATA: another folder, for tests only
for fn in sorted(glob.glob(os.path.join(SRC, '*.json'))):
    r = json.load(open(fn, encoding='utf8')); a = r.get('area') or {}
    if r.get('status') == 'withdrawn': report.append((r['id'], 'skipped: withdrawn')); continue
    pts, plist = {}, []
    for p in a.get('points') or []:
        la, lo = parse(p['lat']), parse(p['lon'])
        pts[p['n']] = (lo, la)
        q = {'n': p['n'], 'la': round(la, 6), 'lo': round(lo, 6)}
        if p.get('name'): q['nm'] = p['name']
        if p.get('inferred'): q['inf'] = 1
        plist.append(q)
    sh, rings, rgs = a.get('shape'), [], None
    try:
        if sh == 'polygon' and len(plist) >= 3:
            rings = [[pts[p['n']] for p in a['points']]]; rgs = 'official' if not any(p.get('inferred') for p in a['points']) else 'official, some points inferred'
        elif sh == 'lines': rings, rgs = lines_area(r, pts)
        elif sh in ('territorial-sea', 'eez') and r['id'] not in NO_AREA: rings, rgs = derived_area(r)
        elif sh == 'circle': rgs = 'official'
        elif sh == 'lat_limit' and a.get('bbox'):
            b4 = a['bbox']; rings = [[(b4[0], b4[1]), (b4[2], b4[1]), (b4[2], b4[3]), (b4[0], b4[3])]]; rgs = 'derived'
    except Exception as e:
        print('AREA FAIL', r['id'], e, file=sys.stderr); report.append((r['id'], 'area failed: %s' % e))
    bb = a.get('bbox')
    if bb and bb[2] < bb[0]: bb = [bb[0], bb[1], bb[2] + 360, bb[3]]
    ar = {'sh': sh}
    if plist: ar['pts'] = plist
    if a.get('lines'): ar['lines'] = a['lines']
    if sh == 'circle' and a.get('center'):
        c = a['center']; ar['c'] = {'la': parse(c['lat']) if isinstance(c.get('lat'), str) else c['lat'], 'lo': parse(c['lon']) if isinstance(c.get('lon'), str) else c['lon']}; ar['r'] = a.get('radius_nm')
    for k in ('state', 'zone', 'ports'):
        if a.get(k): ar[k] = a[k]
    if bb: ar['bbox'] = bb
    rec = {'id': r['id'], 'sys': r.get('system'), 't': r.get('title'), 'cty': r.get('country'), 'au': r.get('authority'), 'k': r.get('kind'), 'res': r.get('resolution'),
           'st': r.get('status'), 'eff': r.get('effective'), 'ap': r.get('applies_to'), 'apq': r.get('applies_quote'),
           'when': [{k2: v for k2, v in (('e', w.get('event')), ('h', w.get('hours_before')), ('iv', w.get('interval_h')), ('rep', w.get('report')), ('x', w.get('text'))) if v not in (None, '')} for w in r.get('when') or []],
           'how': [{k2: v for k2, v in (('ty', h.get('type')), ('v', h.get('value')), ('to', h.get('to')), ('n', h.get('note'))) if v not in (None, '')} for h in r.get('how') or []],
           'ad': r.get('addressee'), 'hd': r.get('heading'),
           'ln': [{k2: v for k2, v in (('l', l.get('l')), ('r', l.get('req')), ('x', l.get('text')), ('s', std_letter(r, l))) if v not in (None, '')} for l in r.get('lines') or []],
           'fn': r.get('format_note'), 'ar': ar, 'aq': r.get('area_quote'),
           'src': [{k2: v for k2, v in (('t', s.get('title')), ('ref', s.get('ref')), ('date', s.get('date')), ('url', s.get('url'))) if v} for s in r.get('sources') or [] if s.get('primary', True)][:4],
           'chk': r.get('checked'), 'ver': r.get('verification'), 'cf': r.get('confidence'), 'nt': r.get('notes'), 'grp': group(r)}
    if rings: rec['rg'] = [enc(x) for x in rings]; rec['rgs'] = 'official' if rgs and rgs.startswith('official') else 'derived'; rec['rgn'] = rgs
    elif sh == 'circle': rec['rgs'] = 'official'
    out.append({k: v for k, v in rec.items() if v not in (None, '', [], {})})
    report.append((r['id'], '%s, %d points, %d rings, %d vertices' % (sh, len(plist), len(rings), sum(len(x) for x in rings))))
out.sort(key=lambda x: (GROUPS.index(x['grp']), x['t'].lower()))
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
open(os.environ.get('SR_OUT') or os.path.join(ROOT, 'data', 'reporting.packed.json'), 'w', encoding='utf8').write(s)
for line in report: print('%-40s %s' % line)
print('systems', len(out), 'bytes', len(s.encode()))
