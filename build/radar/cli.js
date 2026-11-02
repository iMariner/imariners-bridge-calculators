// Run SPEC cases through the app engine: node build/radar/cli.js cases.json > results.json
const fs = require('fs');
const Radar = new Function(fs.readFileSync(__dirname + '/radar.js', 'utf8') + 'return Radar;')();
const r1 = x => Math.round(x * 1000) / 1000;
const out = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map(c => {
  try {
    const r = Radar.solve(Radar.normalize(c)); if (r.error) return { id: c.id, error: r.error };
    const o = { id: c.id, rel: { course: r1(r.rel.course), speed: r1(r.rel.speed) }, tgt: { course: r1(r.tgt.course), speed: r1(r.tgt.speed) },
      cpa: r.cpa.passed || r.cpa.steady ? { passed: true, range: r1(r.cpa.range) } : { range: r1(r.cpa.range), brg: r1(r.cpa.brg), tcpa: r1(r.cpa.tcpa), time: r.cpa.time },
      aspect: r.aspect === null ? null : r1(r.aspect), bcr: r.bcr && { range: r1(r.bcr.range), t: r1(r.bcr.t) }, scr: r.scr && { range: r1(r.scr.range), t: r1(r.scr.t) } };
    if (r.ground) o.ground = { course: r1(r.ground.course), speed: r1(r.ground.speed), set: r1(r.ground.set), drift: r1(r.ground.drift) };
    if (r.action) { const a = r.action; o.action = a.error ? { error: a.error, portCourse: a.portCourse } : { cpa: r1(a.cpa), tcpa: r1(a.tcpa), time: a.time, course: r1(a.course), speed: r1(a.speed), portCourse: a.portCourse === undefined ? undefined : a.portCourse, resume: a.resume && a.resume.time }; }
    return o;
  } catch (e) { return { id: c.id, error: String(e.message) }; }
});
console.log(JSON.stringify(out, null, 1));
