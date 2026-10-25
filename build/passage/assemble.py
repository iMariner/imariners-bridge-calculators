"""Insert or refresh the Passage Plan tool in Bridge-Calculators.html from build/passage sources. Safe to re-run."""
p='Bridge-Calculators.html'; h=open(p,encoding='utf8').read(); b='build/passage/'
rd=lambda f: open(b+f,encoding='utf8').read()
NAV='''    <a href="#passage-plan" data-tool-link="passage-plan">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18c6 0 4-12 10-12" stroke-dasharray="3 3"/></svg>
      Passage Plan
    </a>
'''
if 'data-tool-link="passage-plan"' not in h:
    a='    <a href="#course-speed" data-tool-link="course-speed">'; assert h.count(a)==1; h=h.replace(a,NAV+a)
    a='var TOOLS = { '; assert h.count(a)==1; h=h.replace(a,'var TOOLS = { "passage-plan": initPassagePlan, ')
def put(h, start, end, new, anchor):
    if start in h:
        i=h.index(start); j=h.index(end,i)+len(end); return h[:i]+new+h[j:]
    k=h.index(anchor); return h[:k]+new+h[k:]
h=put(h,'    <section class="tool cmp" id="passage-plan"','    </section>\n',rd('page.html').rstrip()+'\n','  </main>')
h=put(h,'\n/* Passage Plan */','  #pp-sheet .ps-sign { margin-top: 10mm; }\n}\n',rd('page.css').rstrip('\n')+'\n','</style>')
h=put(h,'  /* PASSAGE-BEGIN */','  /* PASSAGE-END */\n',rd('calc.js'),'  /* Tool registry and routing */')
h=put(h,'  /* Tool: Passage Plan','    build(); render();\n  }\n\n',rd('page.js'),'  /* Tool registry and routing */')
open(p,'w',encoding='utf8').write(h)
