"""Rebuild the Sight Fix parts of Bridge-Calculators.html from build/sight sources (section, css, js). Safe to re-run.
Each part is replaced only between its own start and end markers, so tools placed after it are never touched."""
p='Bridge-Calculators.html'; h=open(p,encoding='utf8').read(); b='build/sight/'
rd=lambda f: open(b+f,encoding='utf8').read()
def swap(h, start, ends, new):
    i=h.index(start)
    for e in ends:                              # first end marker that exists after the start
        j=h.find(e,i)
        if j>=0: return h[:i]+new+h[j+(len(e) if e.endswith('\n') else 0):]   # an end marker ending in a newline belongs to this tool and is replaced too
    raise SystemExit('end marker not found for '+start)
h=swap(h,'    <section class="tool cmp" id="sight-fix"',['    </section>\n'],rd('page.html').rstrip()+'\n')
h=swap(h,'\n/* Sight Fix */',['/* Sight Fix end */\n','</style>'],rd('page.css').rstrip('\n')+'\n')
h=swap(h,'  /* SIGHT-BEGIN */',['  /* SIGHTPAGE-END */\n','  /* PASSAGE-BEGIN */','  /* Tool registry and routing */'],rd('engine.js').rstrip()+'\n\n'+rd('fix.js').rstrip()+'\n\n'+rd('plot.js').rstrip()+'\n\n'+rd('page.js').rstrip('\n')+'\n\n')
open(p,'w',encoding='utf8').write(h)
