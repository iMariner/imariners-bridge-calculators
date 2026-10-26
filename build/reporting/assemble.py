"""Put the Ship Reporting page into Bridge-Calculators.html from build/reporting sources. Safe to re-run: each part sits between its own markers.
Run build.py first (it writes data/reporting.packed.json)."""
import os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
p = os.path.join(root, 'Bridge-Calculators.html'); h = open(p, encoding='utf8').read(); b = os.path.join(root, 'build', 'reporting') + os.sep
rd = lambda f: open(b + f, encoding='utf8').read()
data = open(os.path.join(root, 'data', 'reporting.packed.json'), encoding='utf8').read().strip()

def put(h, start, end, new, before):
    """replace start..end (end included) with new, or insert new before the anchor 'before' the first time"""
    i = h.find(start)
    if i >= 0:
        j = h.index(end, i) + len(end)
        return h[:i] + new + h[j:]
    k = h.index(before)
    return h[:k] + new + h[k:]

nav = '''    <a href="#ship-reporting" data-tool-link="ship-reporting">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V5"/><path d="M4 5h11l-2 3.5 2 3.5H4"/><path d="M15 17l3 3 3-3"/><path d="M18 11v9"/></svg>
      Ship Reporting
    </a>
'''
h = put(h, '    <a href="#ship-reporting"', '    </a>\n', nav, '    <a href="#charts-pubs" data-tool-link="charts-pubs">')
h = put(h, '    <section class="tool" id="ship-reporting"', '    </section>\n', rd('page.html').rstrip() + '\n\n', '    <section class="tool" id="charts-pubs"')
h = put(h, '\n/* Ship Reporting */', '/* Ship Reporting end */\n', rd('page.css').rstrip('\n') + '\n', '</style>')
js = ('  /* SREP-BEGIN: Ship Reporting Systems. Sources: build/reporting (route.js, map.js, page.js) and data/reporting/*.json packed by build/reporting/build.py */\n'
      + rd('route.js').rstrip() + '\n\n' + rd('map.js').rstrip() + '\n\n'
      + '  var SR_SYSTEMS = ' + data + ';\n\n' + rd('page.js').rstrip() + '\n  /* SREP-END */\n\n')
h = put(h, '  /* SREP-BEGIN', '  /* SREP-END */\n\n', js, '  /* Tool registry and routing */')
if '"ship-reporting": initShipReporting' not in h:
    h = h.replace('var TOOLS = { ', 'var TOOLS = { "ship-reporting": initShipReporting, ', 1)
open(p, 'w', encoding='utf8').write(h)
print('assembled, html bytes', len(h.encode()))
