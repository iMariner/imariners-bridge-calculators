// App engine against the independent oracle (oracle.py, written without seeing radar.js):
// node build/radar/compare.js cases_random.json results_random.json   (also cases_book.json results_book.json)
const fs = require('fs');
const Radar = new Function(fs.readFileSync(__dirname + '/radar.js', 'utf8') + 'return Radar;')();
const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), want = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const byId = {}; want.forEach(w => byId[w.id] = w);
let n = 0, bad = 0; const diffs = [];
const ad = (a, b) => Math.abs(Radar.n180(a - b));
function chk(id, what, a, b, tol, ang) { if (a === undefined || b === undefined || a === null || b === null) return; n++; const d = ang ? ad(a, b) : Math.abs(a - b); if (!(d <= tol)) { bad++; diffs.push(id + ' ' + what + ': app ' + (+a).toFixed(3) + ' oracle ' + (+b).toFixed(3)); } }
cases.forEach(c => {
  const o = byId[c.id]; if (!o || o.error) return;
  const r = Radar.solve(Radar.normalize(c)); if (r.error) { bad++; diffs.push(c.id + ' app error ' + r.error); return; }
  chk(c.id, 'rel course', r.rel.course, o.rel.course, 0.2, 1); chk(c.id, 'rel speed', r.rel.speed, o.rel.speed, 0.05);
  if (r.tgt.speed > 0.2) chk(c.id, 'tgt course', r.tgt.course, o.tgt.course, 0.2, 1); chk(c.id, 'tgt speed', r.tgt.speed, o.tgt.speed, 0.05);
  if (o.cpa.passed || o.cpa.steady) { n++; if (!(r.cpa.passed || r.cpa.steady)) { bad++; diffs.push(c.id + ' oracle says passed/steady'); } }
  else { chk(c.id, 'cpa', r.cpa.range, o.cpa.range, 0.02); chk(c.id, 'cpa brg', r.cpa.brg, o.cpa.brg, 0.5, 1); chk(c.id, 'tcpa', r.cpa.tcpa, o.cpa.tcpa, 0.2); }
  if (r.aspect !== null && o.aspect !== null) chk(c.id, 'aspect', r.aspect, o.aspect, 0.3, 1);
  if (r.cpa.range > 0.05) { ['bcr', 'scr'].forEach(k => { if (!!r[k] !== !!o[k]) { n++; bad++; diffs.push(c.id + ' ' + k + ' app ' + JSON.stringify(r[k] && r[k].range) + ' oracle ' + JSON.stringify(o[k])); } else if (r[k]) { chk(c.id, k, r[k].range, o[k].range, 0.02); chk(c.id, k + ' t', r[k].t, o[k].t, 0.2); } }); }
  if (r.ground && o.ground) { chk(c.id, 'set', r.ground.set, o.ground.set, 0.3, 1); chk(c.id, 'drift', r.ground.drift, o.ground.drift, 0.05); chk(c.id, 'cmg', r.ground.course, o.ground.course, 0.3, 1); }
  const a = r.action, b = o.action; if (!a || !b) return;
  const bFail = b.course === null || b.course === undefined || b.speed === null || (c.action.find && b.passed && b.cpa < (c.action.want || c.cpaLimit) - 1e-6);
  if (a.error || bFail) { n++; if (!(a.error && bFail)) { bad++; diffs.push(c.id + ' action: app ' + (a.error || a.course) + ' oracle ' + b.course); } return; }
  chk(c.id, 'new course', a.course, b.course, 0.2, 1); chk(c.id, 'new speed', a.speed, b.speed, 0.05);
  if (!a.passed && b.tcpa !== null) { chk(c.id, 'action cpa', a.cpa, b.cpa, 0.02); chk(c.id, 'action tcpa', a.tcpa, b.tcpa, 0.2); }
  if (b.resume && a.resume) chk(c.id, 'resume', a.resume.after, b.resume.t, 0.15);
  else if (!!b.resume !== !!a.resume) { n++; bad++; diffs.push(c.id + ' resume app ' + (a.resume && a.resume.time) + ' oracle ' + (b.resume && b.resume.time) + (a.passed ? ' (app: opening after action)' : '')); }
});
diffs.slice(0, 40).forEach(d => console.log('DIFF', d));
console.log((bad ? bad + ' differences' : 'all agree') + ' in ' + n + ' comparisons');
