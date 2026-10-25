import json,glob,math,re,sys,os
from shapely.geometry import shape,box,Polygon,LineString,Point,MultiPolygon
from shapely.ops import unary_union,transform
from shapely.strtree import STRtree
import numpy as np
DATA=os.environ.get('SEA_AREAS_DATA','../../../sea-areas/data/')
if not DATA.endswith('/'): DATA+='/'
RX=re.compile(r"^\s*(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?\s*([NSEW])\s*$")
def parse(s):
    m=RX.match(s)
    if not m: raise ValueError(s)
    v=float(m[1])+(float(m[2])/60 if m[2] else 0)+(float(m[3])/3600 if m[3] else 0)
    return -v if m[4] in 'SW' else v
def merc(lat):
    lat=max(min(lat,85.0),-85.0);return math.degrees(math.log(math.tan(math.pi/4+math.radians(lat)/2)))
def imerc(y): return math.degrees(2*math.atan(math.exp(math.radians(y)))-math.pi/2)
def proj(g): return transform(lambda x,y,z=None:(x,np.degrees(np.log(np.tan(np.pi/4+np.radians(np.clip(y,-85,85))/2)))),g)
def unproj(g): return transform(lambda x,y,z=None:(x,np.degrees(2*np.arctan(np.exp(np.radians(y)))-np.pi/2)),g)
d=json.load(open('ne_10m_land.geojson'))
polys=[]
for f in d['features']:
    g=shape(f['geometry'])
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]): polys.append(p)
tree=STRtree(polys)
def land_in(bb):
    b=box(*bb);parts=[polys[i].intersection(b) for i in tree.query(b)];parts=[p for p in parts if not p.is_empty]
    return proj((unary_union(parts) if parts else Polygon()).buffer(0))
def extend(c,dd=0.8):
    def push(a,b):
        dx,dy=a[0]-b[0],a[1]-b[1];n=math.hypot(dx,dy) or 1;return (a[0]+dx/n*dd,a[1]+dy/n*dd)
    return [push(c[0],c[1])]+c+[push(c[-1],c[-2])]
def area_geom(rec):
    bb=rec['bbox'];pts={}
    for p in rec.get('points',[]):
        try: pts[p['n']]=(parse(p['lon']),parse(p['lat']))
        except Exception: pass
    pb=box(bb[0],merc(bb[1]),bb[2],merc(bb[3]));lnd=land_in(bb);water=pb.difference(lnd)
    P=lambda lon,lat:(lon,merc(lat))
    shp=rec.get('shape')
    if shp=='polygon' and len(pts)>=3:
        ring=[P(*pts[p['n']]) for p in rec['points'] if p['n'] in pts]
        return Polygon(ring).buffer(0).intersection(water)
    if shp=='lat_limit':
        lim=rec.get('lat_limit',-60)
        return box(bb[0],merc(bb[1]),bb[2],merc(lim)).difference(lnd)
    if shp=='lines' and rec.get('inside_hint'):
        cut=[]
        for seq in rec.get('lines',[]):
            c=[P(*pts[n]) for n in seq if n in pts]
            if len(c)>=2:
                closed=len(c)>2 and c[0]==c[-1]
                cut.append(LineString(c if closed else extend(c,rec.get('extend',0.8))).buffer(0.004))
        if not cut: return None
        pieces=water.difference(unary_union(cut));h=Point(P(rec['inside_hint']['lon'],rec['inside_hint']['lat']))
        for g in (pieces.geoms if hasattr(pieces,'geoms') else [pieces]):
            if g.contains(h): return g
    return None
def rings(g):
    out=[]
    if g is None or g.is_empty: return out
    for p in (g.geoms if hasattr(g,'geoms') else [g]):
        if p.geom_type!='Polygon' or p.is_empty or p.area<1e-4: continue
        if p.area<0.02: continue
        out.append([[round(c[0],2),round(c[1],2)] for c in p.exterior.coords])
    return out
def dmt(v,pos,neg):
    a=abs(v);dg=int(a+1e-9);m=(a-dg)*60
    if round(m,3)>=60: dg+=1;m=0
    return '%d°%s%s'%(dg,("%s'"%(('%.3f'%m).rstrip('0').rstrip('.'))) if m>1e-6 else '',pos if v>=0 else neg)
out=[]
for f in sorted(glob.glob(DATA+'*.json')):
    r=json.load(open(f))
    if r.get('doc')!='marpol': continue
    rec={'id':r['id'],'title':r['title'],'cat':r['category'],'annexes':r.get('annexes',[]),'status':r.get('status'),'eff':r.get('effective'),'effNote':r.get('effective_note'),
         'quote':r.get('quote'),'conf':r.get('confidence'),'notes':r.get('notes'),'shape':r.get('shape'),'hint':[r['inside_hint']['lat'],r['inside_hint']['lon']] if r.get('inside_hint') else None,
         'bbox':r.get('bbox'),'lines':r.get('lines'),'lat_limit':r.get('lat_limit'),'pollutants':r.get('pollutants'),
         'src':[{'t':s['title'],'ref':s.get('ref'),'date':s.get('date'),'url':s.get('url')} for s in r.get('sources',[]) if s.get('primary')][:3]}
    pts=[]
    for p in r.get('points',[]):
        try: la,lo=parse(p['lat']),parse(p['lon'])
        except Exception: continue
        pts.append({'n':p['n'],'name':p.get('name',''),'lat':round(la,5),'lon':round(lo,5),'off':bool(p.get('official',True)) and not p.get('inferred',False)})
    rec['pts']=pts
    try:
        g=area_geom(r) if r.get('bbox') else None
    except Exception as e:
        print('GEOM FAIL',r['id'],e);g=None
    if g is not None and not g.is_empty:
        g=g.simplify(0.01,preserve_topology=True);g=unproj(g)
    rec['region']=rings(g)
    print(r['id'],len(pts),'pts','region rings',len(rec['region']),'verts',sum(len(x) for x in rec['region']),'shape',r.get('shape'))
    out.append(rec)
json.dump(out,open('areas.json','w'),separators=(',',':'))
print('areas.json bytes',os.path.getsize('areas.json'))
