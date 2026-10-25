var fs=require('fs');var src=fs.readFileSync('calc.js','utf8');
eval(src.replace('var RP =','global.RP ='));
var assert=require('assert');
// user's example: DTG 500 then 240, 24 h
var rows=[{type:'cosp',date:'2026-10-01',time:'12:00',zone:'8',dtg:'1000'},{type:'noon',date:'2026-10-02',time:'12:00',zone:'8',dtg:'500'},{type:'noon',date:'2026-10-03',time:'12:00',zone:'8',dtg:'240'}];
var c=RP.compute(rows);
assert.strictEqual(c[1].dist,500);assert.strictEqual(c[2].dist,260);assert.strictEqual(c[2].hours,24);
assert(Math.abs(c[2].speed-260/24)<1e-9);
var t=RP.totals(rows,c);assert.strictEqual(t.dist,760);assert.strictEqual(t.hours,48);assert(Math.abs(t.speed-760/48)<1e-9);
console.log('example ok',RP.fmtSpeed(c[2].speed),RP.fmtDur(t.hours),RP.fmtDist(t.dist));
// clocks forward 1 h: zone 8 -> 9 means 23 h
var r2=[{type:'cosp',date:'2026-10-01',time:'12:00',zone:'8',dtg:'1000'},{type:'noon',date:'2026-10-02',time:'12:00',zone:'9',dtg:'770'}];
var c2=RP.compute(r2);assert.strictEqual(c2[1].hours,23);console.log('zone change 23h ok',RP.fmtSpeed(c2[1].speed));
// DTG up: warning, no dist
var r3=[{type:'cosp',date:'2026-10-01',time:'12:00',zone:'8',dtg:'100'},{type:'noon',date:'2026-10-02',time:'12:00',zone:'8',dtg:'120'}];
var c3=RP.compute(r3);assert(c3[1].warn&&c3[1].dist===null);
r3[1].ovr='15';c3=RP.compute(r3);assert.strictEqual(c3[1].dist,15);assert.strictEqual(c3[1].warn,'');console.log('override ok');
// eosp then noon -> warn
var r4=[{type:'cosp',date:'2026-10-01',time:'12:00',zone:'8',dtg:'300'},{type:'eosp',date:'2026-10-02',time:'06:00',zone:'8',dtg:'0'},{type:'noon',date:'2026-10-03',time:'12:00',zone:'8',dtg:'200'}];
var c4=RP.compute(r4);assert.strictEqual(c4[1].dist,300);assert.strictEqual(c4[1].hours,18);assert(c4[2].warn);
// time backwards
var r5=[{type:'cosp',date:'2026-10-02',time:'12:00',zone:'8',dtg:'300'},{type:'noon',date:'2026-10-01',time:'12:00',zone:'8',dtg:'200'}];
assert(RP.compute(r5)[1].warn);
// month summary
var v=[{name:'V1',cond:'Loaded',rows:[{type:'cosp',date:'2026-09-29',time:'12:00',zone:'8',dtg:'900'},{type:'noon',date:'2026-09-30',time:'12:00',zone:'8',dtg:'640'},{type:'noon',date:'2026-10-01',time:'12:00',zone:'8',dtg:'380'},{type:'noon',date:'2026-10-02',time:'12:00',zone:'8',dtg:'120'}]},
{name:'V2',cond:' ballast ',rows:[{type:'cosp',date:'2026-10-05',time:'12:00',zone:'8',dtg:'480'},{type:'noon',date:'2026-10-06',time:'12:00',zone:'8',dtg:'240'}]},{name:'V3',cond:'Ballast',rows:[{type:'cosp',date:'2026-10-10',time:'00:00',zone:'0',dtg:'100'},{type:'noon',date:'2026-10-10',time:'12:00',zone:'0',dtg:'40'}]}];
var s=RP.summary(v,'2026-10');
assert.strictEqual(s.groups.length,2);assert.strictEqual(s.groups[0].dist,520);assert.strictEqual(s.groups[1].label,'Ballast');assert.strictEqual(s.groups[1].dist,300);assert.strictEqual(s.total.dist,820);
var s9=RP.summary(v,'2026-09');assert.strictEqual(s9.total.dist,260);
console.log('month ok',JSON.stringify(s.groups.map(g=>[g.label,g.dist,RP.fmtDur(g.hours),RP.fmtSpeed(g.speed)])));
console.log('ALL OK');
