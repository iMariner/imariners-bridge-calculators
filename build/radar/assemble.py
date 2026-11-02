"""Put the Radar Plotting page into Bridge-Calculators.html from build/radar sources (radar.js engine, page.html, page.css, page.js).
Safe to re-run: each part sits between its own markers. Test: node build/radar/test_radar.js, then node build/tools/smoke.js."""
import os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
p = os.path.join(root, 'Bridge-Calculators.html'); h = open(p, encoding='utf8').read(); b = os.path.join(root, 'build', 'radar') + os.sep
rd = lambda f: open(b + f, encoding='utf8').read()

def put(h, start, end, new, before):
    """replace start..end (end included) with new, or insert new before the anchor 'before' the first time"""
    i = h.find(start)
    if i >= 0:
        j = h.index(end, i) + len(end)
        return h[:i] + new + h[j:]
    k = h.index(before)
    return h[:k] + new + h[k:]

nav = '''    <a href="#radar-plot" data-tool-link="radar-plot">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/><circle cx="16.5" cy="15.5" r="1" fill="currentColor"/></svg>
      Radar Plotting
    </a>
'''
h = put(h, '    <a href="#radar-plot"', '    </a>\n', nav, '    <a href="#true-wind" data-tool-link="true-wind">')
h = put(h, '    <section class="tool" id="radar-plot"', '    </section>\n', rd('page.html').rstrip() + '\n', '    <section class="tool" id="true-wind"')
h = put(h, '\n/* Radar Plotting */', '/* Radar Plotting end */\n', rd('page.css').rstrip('\n') + '\n', '</style>')
js = '  /* RADARPAGE-BEGIN: Radar Plotting page. Sources: build/radar (radar.js engine, page.js) */\n' + rd('radar.js').rstrip() + '\n\n' + rd('page.js').rstrip() + '\n  /* RADARPAGE-END */\n\n'
h = put(h, '  /* RADARPAGE-BEGIN', '  /* RADARPAGE-END */\n\n', js, '  /* Tool registry and routing */')
if '"radar-plot": initRadarPlot' not in h:
    h = h.replace('var TOOLS = { ', 'var TOOLS = { "radar-plot": initRadarPlot, ', 1)
open(p, 'w', encoding='utf8').write(h)
print('assembled, html bytes', len(h.encode()))
