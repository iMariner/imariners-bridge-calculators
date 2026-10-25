// Print one tool (with its example data) to PDF to check the one-page print sheets.
// usage: node build/tools/printpdf.js <tool-id> <example-button-id> <out.pdf>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const [tool, btn, out] = process.argv.slice(2);
const file = 'file://' + path.resolve(__dirname, '../../Bridge-Calculators.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9800 + Math.floor(Math.random() * 100);
const prof = fs.mkdtempSync('/tmp/pdfprof-');
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (t.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Page.navigate', { url: file + '#' + tool }); await sleep(1500);
  await send('Runtime.evaluate', { expression: `document.getElementById('${btn}').click();0` }); await sleep(600);
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(out, Buffer.from(pdf.result.data, 'base64')); ws.close(); ch.kill(); process.exit(0);
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
