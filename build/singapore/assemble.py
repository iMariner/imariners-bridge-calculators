"""Put the Singapore Strait page into Bridge-Calculators.html from build/singapore sources. Safe to re-run: each part sits between its own markers.
Run build.py first (it writes data/singapore.packed.json). Also re-run build/reporting/assemble.py after changing build/reporting/map.js (SeaMap)."""
import os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
p = os.path.join(root, 'Bridge-Calculators.html'); h = open(p, encoding='utf8').read(); b = os.path.join(root, 'build', 'singapore') + os.sep
rd = lambda f: open(b + f, encoding='utf8').read()
data = open(os.path.join(root, 'data', 'singapore.packed.json'), encoding='utf8').read().strip()

def put(h, start, end, new, before):
    """replace start..end (end included) with new, or insert new before the anchor 'before' the first time"""
    i = h.find(start)
    if i >= 0:
        j = h.index(end, i) + len(end)
        return h[:i] + new + h[j:]
    k = h.index(before)
    return h[:k] + new + h[k:]

nav = '''    <a href="#singapore" data-tool-link="singapore">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-2 5-2 8 0s5 2 8 0"/><path d="M3 12c3-2 5-2 8 0s5 2 8 0"/><path d="M8 4v5M16 4v5"/></svg>
      Singapore Strait
    </a>
'''
h = put(h, '    <a href="#singapore"', '    </a>\n', nav, '    <a href="#charts-pubs" data-tool-link="charts-pubs">')
h = put(h, '    <section class="tool" id="singapore"', '    </section>\n', rd('page.html').rstrip() + '\n\n', '    <section class="tool" id="charts-pubs"')
h = put(h, '\n/* Singapore Strait */', '/* Singapore Strait end */\n', rd('page.css').rstrip('\n') + '\n', '</style>')
js = ('  /* SGS-BEGIN: Singapore Strait reporting chart. Sources: build/singapore (page.js) and data/singapore (build.py) */\n'
      + '  var SGS = ' + data + ';\n\n' + rd('page.js').rstrip() + '\n  /* SGS-END */\n\n')
h = put(h, '  /* SGS-BEGIN', '  /* SGS-END */\n\n', js, '  /* Tool registry and routing */')
if '"singapore": initSingapore' not in h:
    h = h.replace('var TOOLS = { ', 'var TOOLS = { "singapore": initSingapore, ', 1)
open(p, 'w', encoding='utf8').write(h)
print('assembled, html bytes', len(h.encode()))
