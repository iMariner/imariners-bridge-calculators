// Measure start-up and heaviest page on a slowed-down CPU (6x slower is roughly an old ship laptop).
// usage: node build/tools/perf.js [cpuSlowdown]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const SLOW = +process.argv[2] || 6;
const file = 'file://' + path.resolve(__dirname, '../../Bridge-Calculators.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9500 + Math.floor(Math.random() * 300);
const prof = fs.mkdtempSync('/tmp/perfprof-');
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', '--enable-precise-memory-info', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
  await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  const out = { sizeMB: +(fs.statSync(path.resolve(__dirname, '../../Bridge-Calculators.html')).size / 1048576).toFixed(2), cpuSlowdown: SLOW };
  const t0 = Date.now(); await send('Page.navigate', { url: file + '#gyro-error' });
  for (let i = 0; i < 200; i++) { await sleep(50); if (await ev(`document.readyState==='complete'&&!!document.getElementById('ge-example')`)) break; }
  out.firstPageReadyMs = Date.now() - t0;
  out.timing = await ev(`(()=>{const n=performance.getEntriesByType('navigation')[0];return {domContentLoadedMs:Math.round(n.domContentLoadedEventEnd),loadMs:Math.round(n.loadEventEnd)}})()`);
  const heap = async () => Math.round(await ev(`performance.memory.usedJSHeapSize`) / 1048576);
  out.heapAfterLoadMB = await heap();
  const ms = await ev(`(async()=>{const t=performance.now();location.hash='#special-areas';while(!document.getElementById('sa-canvas')||document.getElementById('special-areas').hidden)await new Promise(r=>setTimeout(r,10));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return Math.round(performance.now()-t)})()`);
  out.openSpecialAreasMs = ms;
  out.heapAfterMapMB = await heap();
  out.mapFramesMs = await ev(`(async()=>{document.getElementById('sa-showall').click();document.getElementById('sa-world').click();const cv=document.getElementById('sa-canvas');const r=cv.getBoundingClientRect();const t=performance.now();for(let i=0;i<10;i++){cv.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,clientX:r.left+200,clientY:r.top+200,bubbles:true,cancelable:true}));await new Promise(r=>requestAnimationFrame(r));}const a=(performance.now()-t)/10;return Math.round(a)})()`);
  console.log(JSON.stringify(out, null, 1)); ws.close(); ch.kill(); process.exit(0);
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
