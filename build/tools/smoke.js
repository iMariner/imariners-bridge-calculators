// Smoke test: open every tool in headless Chrome, press its example button (and the Sight Fix methods), fail on any page error.
// usage: node build/tools/smoke.js
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const file = 'file://' + (process.env.FILE ? path.resolve(process.env.FILE) : path.resolve(__dirname, '../../Bridge-Calculators.html'));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9900 + Math.floor(Math.random() * 90);
const prof = fs.mkdtempSync('/tmp/smokeprof-'), sleep = ms => new Promise(r => setTimeout(r, ms));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const STEPS = [
  ['gyro-error', "document.getElementById('ge-example').click()"], ['dev-card', "document.getElementById('dc-example') && document.getElementById('dc-example').click()"],
  ['sun-times', "document.getElementById('su-example').click()"], ['mer-pass', "document.getElementById('mp-example').click()"],
  ['sight-fix', "document.querySelector('[data-m=noon]').click(); document.getElementById('sf-example').click()"],
  ['sight-fix', "document.querySelector('[data-m=stars]').click(); document.getElementById('sf-example').click(); document.getElementById('sf-filldr').click(); document.getElementById('sf-tw-am').click(); document.getElementById('sf-best4').click()"],
  ['sight-fix', "['sunrun','one','mer','polaris','day'].forEach(function (m) { document.querySelector('[data-m=' + m + ']').click(); })"],
  ['sight-fix', "var bad = []; ['noon','sunrun','one','mer','polaris','stars','day'].forEach(function (m) { document.querySelector('[data-m=' + m + ']').click(); document.getElementById('sf-example').click(); if (document.getElementById('sf-out').hidden || document.getElementById('sf-plotbox').hidden || !document.getElementById('sf-plot').innerHTML) bad.push(m); }); if (bad.length) throw new Error('example without a fix or diagram: ' + bad.join(', '))"],
  ['special-areas', "0"], ['course-speed', "document.getElementById('cs-example').click()"], ['eta', "document.getElementById('et-example') && document.getElementById('et-example').click()"],
  ['daily-reports', "0"], ['true-wind', "document.getElementById('tw-example') && document.getElementById('tw-example').click()"],
  ['heel-draught', "document.getElementById('hd-example') && document.getElementById('hd-example').click()"], ['anchor-depth', "document.getElementById('ad-example') && document.getElementById('ad-example').click()"],
  ['ship', "0"], ['true-az', "document.getElementById('az-example').click()"], ['design', "0"]
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
