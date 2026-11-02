import json
from shapely.geometry import shape, Polygon, LineString, Point
from shapely.ops import unary_union
P=json.load(open('sgs_land.json'))
land=unary_union([Polygon(p[0],p[1:]) for p in P]).buffer(0)
d=json.load(open('straitrep.json'))
bad=0
for t in d['tss']:
    pts=[(p['lon'],p['lat']) for p in t['points']]
    if min(x for x,y in pts)<103.2: continue
    for x,y in pts:
        if land.contains(Point(x,y)): print('ON LAND', t['scheme'][:40], t['kind'][:30], x,y); bad+=1
    if len(pts)>1:
        g=LineString(pts+[pts[0]] if t.get('closed') else pts)
        inter=g.intersection(land)
        if inter.length>0: print('CROSSES LAND %.4f deg'%inter.length, t['scheme'][:40], t['kind'][:40])
print('points on land:', bad)
