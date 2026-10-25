import json,hashlib
from shapely.geometry import shape,Polygon,MultiPolygon,box
from shapely.ops import unary_union
A=json.load(open('areas.json'))
def enc(ring):
    xs=[round(c[0]*100) for c in ring];ys=[round(c[1]*100) for c in ring]
    out=[xs[0],ys[0]]
    for i in range(1,len(xs)): out+= [xs[i]-xs[i-1],ys[i]-ys[i-1]]
    return out
seen={};areas=[]
for a in A:
    b=dict(a)
    if a['shape']=='lat_limit': b['region']=[]
    rg=b['region']
    key=hashlib.md5(json.dumps(rg).encode()).hexdigest() if rg else None
    if key and key in seen: b['regionSame']=seen[key];b['region']=[]
    else:
        if key: seen[key]=a['id']
        b['region']=[enc(r) for r in rg]
    for k in ('annexes','lines','lat_limit','pollutants','hint','bbox','src','notes','quote','effNote','eff','conf'):
        if b.get(k) in (None,[],''): b.pop(k,None)
    b['pts']=[{'n':p['n'],'nm':p['name'],'la':p['lat'],'lo':p['lon'],**({} if p['off'] else {'inf':1})} for p in b['pts']]
    areas.append(b)
s=json.dumps(areas,separators=(',',':'),ensure_ascii=False)
open('areas.packed.json','w').write(s);print('areas packed bytes',len(s.encode()))
# land
d=json.load(open('ne_50m_land.geojson'));polys=[]
for f in d['features']:
    g=shape(f['geometry'])
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]): polys.append(p)
land=[]
for p in polys:
    q=p.simplify(0.02,preserve_topology=True)
    for r in (q.geoms if q.geom_type=='MultiPolygon' else [q]):
        if r.is_empty or r.area<0.004: continue
        rings=[enc(list(r.exterior.coords))]+[enc(list(i.coords)) for i in r.interiors if Polygon(i).area>0.01]
        land.append(rings)
ls=json.dumps(land,separators=(',',':'))
open('land.packed.json','w').write(ls);print('land polys',len(land),'verts',sum(len(r)//2 for p in land for r in p),'bytes',len(ls))
