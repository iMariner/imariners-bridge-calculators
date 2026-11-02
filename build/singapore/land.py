import json, sys
from shapely.geometry import LineString, Polygon, box, Point
from shapely.ops import linemerge, polygonize, unary_union
from shapely.strtree import STRtree
W,S,E,N = 103.20, 0.80, 104.70, 1.80
d = json.load(open('coast/coast.json'))
lines = []
for el in d['elements']:
    if el['type']=='way' and 'geometry' in el:
        pts=[(p['lon'],p['lat']) for p in el['geometry']]
        if len(pts)>1: lines.append(LineString(pts))
print('ways', len(lines))
merged = linemerge(lines)
segs = list(merged.geoms) if merged.geom_type=='MultiLineString' else [merged]
bb = box(W,S,E,N)
clipped=[]
for g in segs:
    c=g.intersection(bb)
    if c.is_empty: continue
    if c.geom_type=='LineString': clipped.append(c)
    elif c.geom_type=='MultiLineString': clipped += list(c.geoms)
print('pieces', len(clipped))
noded = unary_union(clipped + [bb.exterior])
faces = list(polygonize(noded))
print('faces', len(faces))
# land side: OSM coastline has land on the LEFT of the way direction
segs_list=[]
for ln in clipped:
    cs=list(ln.coords)
    for i in range(len(cs)-1): segs_list.append((cs[i],cs[i+1]))
seg_geoms=[LineString(s) for s in segs_list]
tree=STRtree(seg_geoms)
land=[]
import math
for f in faces:
    votes=0
    cs=list(f.exterior.coords)
    step=max(1,len(cs)//40)
    for i in range(0,len(cs)-1,step):
        (ax,ay),(bx,by)=cs[i],cs[i+1]
        mx,my=(ax+bx)/2,(ay+by)/2
        m=Point(mx,my); idx=tree.nearest(m)
        if seg_geoms[idx].distance(m)>1e-9: continue      # this edge is the bbox, not coast
        (x1,y1),(x2,y2)=segs_list[idx]
        L2=math.hypot(bx-ax,by-ay) or 1
        nx,ny=-(by-ay)/L2,(bx-ax)/L2
        eps=1e-6
        q=Point(mx+nx*eps,my+ny*eps)
        if not f.contains(q): q=Point(mx-nx*eps,my-ny*eps)
        if not f.contains(q): continue
        cross=(x2-x1)*(q.y-y1)-(y2-y1)*(q.x-x1)
        votes+=1 if cross>0 else -1
    if votes>0: land.append(f)
L=unary_union(land)
print('land area deg2', round(L.area,4), 'water', round(bb.area-L.area,4))
L=L.simplify(0.00022, preserve_topology=True)
polys=list(L.geoms) if L.geom_type=='MultiPolygon' else [L]
polys=[p for p in polys if p.area>2e-7]
out=[]
for p in polys:
    rings=[p.exterior]+list(p.interiors)
    out.append([[[round(x,4),round(y,4)] for x,y in r.coords] for r in rings])
json.dump(out, open('sgs_land.json','w'), separators=(',',':'))
import os; print('polys', len(out), 'bytes', os.path.getsize('sgs_land.json'))
