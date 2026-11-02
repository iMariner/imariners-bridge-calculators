// Smoke test: open every tool in headless Chrome, press its example button (and the Sight Fix methods), fail on any page error.
// usage: node build/tools/smoke.js
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const file = 'file://' + (process.env.FILE ? path.resolve(process.env.FILE) : path.resolve(__dirname, '../../Bridge-Calculators.html'));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9900 + Math.floor(Math.random() * 90);
const prof = fs.mkdtempSync('/tmp/smokeprof-'), sleep = ms => new Promise(r => setTimeout(r, ms));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const STEPS = [
  ['gyro-error', "document.getElementById('ge-example').click()"], ['dev-card', "document.getElementById('dc-example') && document.getElementById('dc-example').click()"],
  ['sun-times', "document.getElementById('su-example').click()"],
  ['sight-fix', "document.querySelector('[data-m=noon]').click(); document.getElementById('sf-example').click()"],
  ['sight-fix', "document.querySelector('[data-m=stars]').click(); document.getElementById('sf-example').click(); document.getElementById('sf-filldr').click(); document.getElementById('sf-tw-am').click(); document.getElementById('sf-best4').click()"],
  ['sight-fix', "['sunrun','one','mer','polaris','day'].forEach(function (m) { document.querySelector('[data-m=' + m + ']').click(); })"],
  ['sight-fix', "var bad = []; ['noon','sunrun','one','mer','polaris','stars','day'].forEach(function (m) { document.querySelector('[data-m=' + m + ']').click(); document.getElementById('sf-example').click(); if (document.getElementById('sf-out').hidden || document.getElementById('sf-plotbox').hidden || !document.getElementById('sf-plot').innerHTML) bad.push(m); }); if (bad.length) throw new Error('example without a fix or diagram: ' + bad.join(', '))"],
  ['ship-reporting', "document.getElementById('sr-example').click(); document.getElementById('sr-f-all').click(); var b = document.querySelectorAll('#sr-list .sr-item'); for (var i = 0; i < b.length; i++) b[i].click(); document.getElementById('sr-world').click(); document.getElementById('sr-copy').click()"],
  ['ship-reporting', "var g = function (i) { return document.getElementById(i); }; g('sr-route').value = '1 43 19.5N 005 20.5E\\n2 42 00.0N 005 00.0E\\n3 40 00.0N 007 30.0E'; g('sr-date').value = '2026-11-10'; g('sr-time').value = '12:00'; g('sr-speed').value = '15'; g('sr-route').dispatchEvent(new Event('input', { bubbles: true })); var t = g('sr-plan').textContent; if (t.indexOf('6 h before sailing') < 0 || t.indexOf('06:00') < 0 || g('sr-route-msg').textContent.indexOf('246 NM') < 0) throw new Error('numbered route or hours before sailing: ' + g('sr-route-msg').textContent)"],
  ['special-areas', "0"], ['charts-pubs', "0"], ['course-speed', "document.getElementById('cs-example').click()"], ['eta', "document.getElementById('et-example') && document.getElementById('et-example').click()"],
  ['daily-reports', "0"], ['true-wind', "document.getElementById('tw-example') && document.getElementById('tw-example').click()"],
  ['heel-draught', "var g = function (i) { return document.getElementById(i); }, set = function (i, v) { g(i).value = v; g(i).dispatchEvent(new Event('input', { bubbles: true })); }; set('hd-beam', '32'); set('hd-draft', '12'); set('hd-heel', '-5'); var a = g('hd-inc').textContent; set('hd-heel', '5'); var b = g('hd-inc').textContent; if (a !== b || a.indexOf('+1.35') < 0) throw new Error('heel either side: ' + a + ' / ' + b); set('hd-heel', '-40'); if (!/0 – 30/.test(g('hd-heel-msg').textContent) || g('hd-inc').textContent.indexOf('-') >= 0) throw new Error('heel -40 accepted: ' + g('hd-inc').textContent)"], ['anchor-depth', "document.getElementById('ad-example') && document.getElementById('ad-example').click()"],
  ['course-speed', "var g = function (i) { return document.getElementById(i); }; g('cs-dr-example').click(); if (g('cs-dr-out').hidden || g('cs-dr-lat').textContent.indexOf(\"18°00.04'N\") < 0 || g('cs-dr-lon').textContent.indexOf(\"065°19.65'E\") < 0) throw new Error('DR example: ' + g('cs-dr-lat').textContent + ' ' + g('cs-dr-lon').textContent); g('cs-dr-to').click(); if (g('cs-course').textContent.indexOf('131.0') < 0 || g('cs-dist').textContent.indexOf('413.0') < 0) throw new Error('Put in To gives ' + g('cs-course').textContent + ' ' + g('cs-dist').textContent)"],
  ['eta', "var z = document.getElementById('et-z0'); document.getElementById('et-example').click(); var c0 = document.querySelector('#et-main tbody tr td.cell').textContent; z.value = '+9:30'; z.dispatchEvent(new Event('input', { bubbles: true })); var c1 = document.querySelector('#et-main tbody tr td.cell').textContent; if (z.getAttribute('aria-invalid') === 'true' || c1 === c0 || /zone/.test(c1)) throw new Error('zone 9:30 not taken: ' + c0 + ' / ' + c1)"],
  ['ship-reporting', "var g = function (i) { return document.getElementById(i); }, go = function (r) { g('sr-route').value = r; g('sr-date').value = '2026-11-10'; g('sr-time').value = '12:00'; g('sr-speed').value = '15'; g('sr-route').dispatchEvent(new Event('input', { bubbles: true })); return g('sr-plan').textContent; }; var sw = go('A 51 30.0N 002 00.0E\\nB 50 30.0N 000 30.0E\\nC 50 00.0N 001 00.0W'), ne = go('C 50 00.0N 001 00.0W\\nB 50 30.0N 000 30.0E\\nA 51 30.0N 002 00.0E'); if (sw.indexOf('NM before entering') >= 0 || sw.indexOf('CH 11 Dover') < 0 || ne.indexOf('2 NM before entering') < 0 || ne.indexOf('CH 11') >= 0 || sw.indexOf('you start inside') >= 0) throw new Error('Dover Strait direction: SW ' + sw.slice(0, 300) + ' / NE ' + ne.slice(0, 300))"],
  ['anchor-depth', "var g = function (i) { return document.getElementById(i); }, set = function (i, v) { g(i).value = v; g(i).dispatchEvent(new Event('input', { bubbles: true })); }; [['anchorWt', '16.125'], ['jShackleWt', '0.815'], ['firstShackleWt', '8.25'], ['shackleWt', '8.25'], ['windlassPull', '62.9'], ['allow', '20'], ['len', '27.5'], ['h', '18'], ['ratedDepth', '82.5']].forEach(function (a) { set('ad-' + a[0], a[1]); }); if (g('ad-water').textContent.indexOf('64.5') < 0 || g('ad-practical').textContent.indexOf('3 shackles') < 0) throw new Error('rated depth is cable hanging: ' + g('ad-water').textContent + ' / ' + g('ad-practical').textContent)"],
  ['eta', "var z = document.getElementById('et-z0'); document.getElementById('et-example').click(); z.value = '9:30'; z.dispatchEvent(new Event('input', { bubbles: true })); var a = document.querySelector('#et-main tbody tr td.cell').textContent; z.value = '9.30'; z.dispatchEvent(new Event('input', { bubbles: true })); var b = document.querySelector('#et-main tbody tr td.cell').textContent; if (a !== b) throw new Error('9.30 read differently from 9:30: ' + a + ' / ' + b)"],
  ['ship', "0"], ['true-az', "document.getElementById('az-example').click()"], ['design', "document.getElementById('ds-audit-run').click(); var t = document.querySelector('.ds-audit-ok'); if (!t) throw new Error('design check not clean')"]
];
(async () => {
  let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}, errs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  let bad = 0;
  for (const [tool, js] of STEPS) {
    errs.length = 0;
    await send('Page.navigate', { url: file + '#' + tool }); await sleep(1200);
    const r = await send('Runtime.evaluate', { expression: '(function(){' + js + '; return 1;})()' }); await sleep(500);
    const ex = r.result && r.result.exceptionDetails ? [r.result.exceptionDetails.exception.description] : [];
    const all = errs.concat(ex);
    console.log((all.length ? 'FAIL ' : 'ok   ') + tool.padEnd(14) + (all.length ? all[0].split('\n')[0] : ''));
    if (all.length) bad++;
  }
  ws.close(); ch.kill(); console.log(bad ? 'SMOKE FAILED: ' + bad : 'smoke test passed: ' + STEPS.length + ' steps'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
