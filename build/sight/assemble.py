"""Rebuild the Sight Fix parts of Bridge-Calculators.html from build/sight sources (section, css, js). Safe to re-run."""
import re
p='Bridge-Calculators.html'; h=open(p,encoding='utf8').read(); b='build/sight/'
rd=lambda f: open(b+f,encoding='utf8').read()
def swap(h, start, end, new, keep_end=True):
    i=h.index(start); j=h.index(end,i)+(0 if keep_end else len(end)); return h[:i]+new+h[j:]
h=swap(h,'    <section class="tool cmp" id="sight-fix"','  </main>',rd('page.html').rstrip()+'\n')
h=swap(h,'\n/* Sight Fix */','</style>',rd('page.css'))
h=swap(h,'  /* SIGHT-BEGIN */','  /* Tool registry and routing */',rd('engine.js').rstrip()+'\n\n'+rd('fix.js').rstrip()+'\n\n'+rd('plot.js').rstrip()+'\n\n'+rd('page.js'))
open(p,'w',encoding='utf8').write(h)
