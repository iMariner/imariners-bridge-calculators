const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const file = 'file://' + path.resolve('Bridge-Calculators.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9900 + Math.floor(Math.random() * 90);
const prof = fs.mkdtempSync('/tmp/tokprof-');
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
  await send('Page.enable'); await send('Page.navigate', { url: file }); await sleep(1500);
  const out = {};
  for (const th of ['day', 'dusk', 'night']) {
    await ev(`document.querySelector('[data-theme-btn=${th}]').click();0`); await sleep(200);
    out[th] = await ev(`(()=>{const r={};['--accent','--danger','--take','--okc','--side-strong','--apparent','--surface','--surface-2'].forEach(t=>{const e=document.createElement('span');e.style.cssText='position:absolute;visibility:hidden;color:var('+t+')';document.body.appendChild(e);r[t]=getComputedStyle(e).color.match(/[\\d.]+/g).slice(0,3).map(Number);document.body.removeChild(e)});return r})()`);
  }
  console.log(JSON.stringify(out)); ws.close(); ch.kill(); process.exit(0);
})();
