import json,math,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MP
areas={a['id']:a for a in json.load(open('areas.json'))}
d=json.load(open('ne_50m_land.geojson'))
def merc(lat): return math.degrees(math.log(math.tan(math.pi/4+math.radians(max(min(lat,85),-85))/2)))
def draw(ids,bb,fn):
    fig=plt.figure(figsize=(8,6),dpi=100);ax=fig.add_axes([0.04,0.04,0.94,0.94])
    for f in d['features']:
        g=f['geometry'];ps=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        for p in ps:
            ax.add_patch(MP([(x,merc(y)) for x,y in p[0]],fc='#ece2c4',ec='#a89a6c',lw=0.4))
    cols=['#2a8','#e82','#38c']
    for k,i in enumerate(ids):
        a=areas[i]
        for r in a['region']:
            ax.add_patch(MP([(x,merc(y)) for x,y in r],fc=cols[k%3],alpha=0.35,ec='none'))
        for p in a['pts']:
            ax.plot(p['lon'],merc(p['lat']),'o' if p['off'] else 's',ms=4,color='k' if p['off'] else 'r')
    ax.set_xlim(bb[0],bb[2]);ax.set_ylim(merc(bb[1]),merc(bb[3]));fig.savefig(fn)
draw(['eca-north-sea'],(-8,47,14,63),'c1.png')
draw(['eca-mediterranean'],(-7,29,37,46),'c2.png')
draw(['marpol-nw-european-waters'],(-14,47,14,63),'c3.png')
