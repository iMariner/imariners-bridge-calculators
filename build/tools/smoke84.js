// Run every smoke.js step in an old Chromium (84), one fresh browser per step with a shared profile (smoke.js itself hangs there when it moves between tools).
// usage: CHROME=<path>/Chromium.app/Contents/MacOS/Chromium node build/tools/smoke84.js [tool-id]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '../..');
const src = fs.readFileSync(REPO + '/build/tools/smoke.js', 'utf8');
const STEPS = eval(src.slice(src.indexOf('const STEPS = [') + 14, src.indexOf('];\n(async') + 1));
const CHROME = process.env.CHROME, file = 'file://' + REPO + '/Bridge-Calculators.html';
const prof = fs.mkdtempSync('/tmp/c84prof-'), sleep = ms => new Promise(r => setTimeout(r, ms));
const only = process.argv[2];
async function step(tool, js, i) {
  let PORT, ch, t;
  for (let tries = 0; tries < 4 && !t; tries++) {
  PORT = 9700 + i * 4 + tries;
  ch = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
  for (let k = 0; k < 80; k++) { try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (j.find(x => x.type === 'page')) { t = j; break; } } catch (e) {} await sleep(250); }
  if (!t) { console.log('retry start, step ' + i); ch.kill(); await sleep(2000); }
  }
  try {
    const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pend = {}, errs = [];
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text); };
    const send = (method, params = {}) => new Promise(r => { const n = ++id; pend[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.navigate', { url: file + '#' + tool }); await sleep(2500);
    const vis = await send('Runtime.evaluate', { expression: "(document.querySelector('main > .tool:not([hidden])')||{}).id + '|' + (document.querySelector('.oldbrowser') && !document.querySelector('.oldbrowser').hidden ? 'BANNER' : '')", returnByValue: true });
    const r = await send('Runtime.evaluate', { expression: '(function(){' + js + '; return 1;})()' }); await sleep(3000);
    const ex = r.result && r.result.exceptionDetails ? [r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text] : [];
    const all = errs.concat(ex), shown = vis.result.result.value;
    console.log((all.length ? 'FAIL ' : 'ok   ') + tool.padEnd(15) + shown.padEnd(22) + (all.length ? all[0].split('\n')[0] : ''));
    ws.close(); return all.length;
  } finally { ch.kill(); await sleep(1500); }
}
(async () => { let bad = 0, ran = 0; for (let i = 0; i < STEPS.length; i++) { if (only && STEPS[i][0] !== only) continue; ran++; bad += await step(STEPS[i][0], STEPS[i][1], i); } console.log(bad ? 'CHROMIUM 84: ' + bad + ' of ' + ran + ' failed' : 'CHROMIUM 84: all ' + ran + ' steps passed'); process.exit(bad ? 1 : 0); })();
