// Screenshot every tool in headless Chrome with example data, for design review.
// usage: node build/tools/shot.js <outDir> [width] [height] [theme]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'shots'), W = +process.argv[3] || 1440, H = +process.argv[4] || 1000, THEME = process.argv[5] || 'day';
const file = 'file://' + path.resolve(__dirname, '../../Bridge-Calculators.html');
fs.mkdirSync(out, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9400 + Math.floor(Math.random() * 400);
const prof = fs.mkdtempSync('/tmp/shotprof-');
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TOOLS = [
  ['true-wind', "document.querySelector('#tool-true-wind,#true-wind')&&0"],
  ['mer-pass', "document.getElementById('mp-example').click()"],
  ['sun-times', "document.getElementById('su-example').click()"],
  ['special-areas', "0"],
  ['gyro-error', "document.getElementById('ge-example').click()"],
  ['dev-card', "document.getElementById('dc-example').click()"],
  ['course-speed', "document.getElementById('cs-example').click()"],
  ['eta', "document.getElementById('et-example').click()"],
  ['daily-reports', "0"],
  ['heel-draught', "0"],
  ['anchor-depth', "0"],
  ['ship', "0"],
  ['design', "0"]
];
(async () => {
  let ws, targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch (e) {} await sleep(250); }
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: file }); await sleep(1500);
  await ev(`localStorage.clear();0`);
  for (const [name, action] of TOOLS) {
    await send('Page.navigate', { url: file + '#' + name }); await sleep(900);
    await ev(`document.querySelector('[data-theme-btn=${THEME}]').click();0`);
    await ev(`try{${action}}catch(e){}0`); await sleep(500);
    const h = await ev(`Math.min(4000,Math.max(${H},document.documentElement.scrollHeight))`);
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(shot.result.data, 'base64')); console.log(name, h);
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  }
  ws.close(); ch.kill(); process.exit(0);
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
