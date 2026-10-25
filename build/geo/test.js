var fs=require('fs');var src=fs.readFileSync('geo.js','utf8');eval(src.replace('var Geo =','global.Geo ='));var assert=require('assert');
var eq=(a,b,t)=>assert(Math.abs(a-b)<(t||1e-9),a+' vs '+b);
// formatting
assert.strictEqual(Geo.lat(48.45),"48°27.0'N");assert.strictEqual(Geo.lon(-6.4166667),"006°25.0'W");assert.strictEqual(Geo.lat(-0.5),"00°30.0'S");
assert.strictEqual(Geo.lat(62),"62°00.0'N");assert.strictEqual(Geo.lon(4.9933),"004°59.6'E");assert.strictEqual(Geo.lat(47.99999),"48°00.0'N");assert.strictEqual(Geo.lon(179.99999),"180°00.0'E");
// parsing table
var T=[["48 27.5 N 006 25.0 W",48+27.5/60,-(6+25/60),""],["48°27.5'N 006°25.0'W",48+27.5/60,-(6+25/60),""],["48-27.5N 006-25.0W",48+27.5/60,-(6+25/60),""],
["WP1 48 27.5 N 6 25 W",48+27.5/60,-(6+25/60),"WP1"],["Point A: 62 00.0 N 5 19.8 E",62,5+19.8/60,"Point A"],["62°00'00\"N 005°19'48\"E",62,5+19.8/60,""],
["N 48 27.5 W 006 25.0",48+27.5/60,-(6+25/60),""],["4827.5N 00625.0W",48+27.5/60,-(6+25/60),""],["48.4583 N 6.4167 W",48.4583,-6.4167,""],
["48.4583, -6.4167",48.4583,-6.4167,""],["Gibraltar 36.0 -5.6",36,-5.6,"Gibraltar"],["51 30.4 N 000 07.6 W",51+30.4/60,-(7.6/60),""],["31°29'N 32°16'E",31+29/60,32+16/60,""],
["lat 40 01 N long 26 12 E",40+1/60,26+12/60,"lat"],["12 30 s 045 10 e",-(12+30/60),45+10/60,""],["35 48 N 5 55 W Cape Spartel",35.8,-(5+55/60),""]];
var bad=0;T.forEach(function(t){var r=Geo.parse(t[0]);if(r.error){console.log('FAIL',t[0],r.error);bad++;return}
 try{eq(r.lat,t[1],1e-6);eq(r.lon,t[2],1e-6);}catch(e){console.log('WRONG',t[0],r.lat,r.lon);bad++;return}
 if(t[3]!==undefined&&r.name!==t[3]&&t[0].indexOf('Cape Spartel')<0){console.log('NAME',t[0],JSON.stringify(r.name),'expected',JSON.stringify(t[3]));bad++}});
// must be rejected
["95 00 N 006 25 W","48 27 N 190 25 E","48 70 N 006 25 W","48 27 N","hello","48 27 N 006 25 N","48 27 N 6 25 W 50 10 N"].forEach(function(s){var r=Geo.parse(s);if(!r.error){console.log('SHOULD REJECT',s,JSON.stringify(r));bad++}});
console.log('parse problems:',bad);
// point in ring and distance
var sq=[0,0,10,0,10,10,0,10];assert(Geo.pointInRing(5,5,sq));assert(!Geo.pointInRing(11,5,sq));assert(!Geo.pointInRing(5,-1,sq));
eq(Geo.distSegNM(0,0.5,0,0,0,1)<1e-9?0:Geo.distSegNM(0,0.5,0,0,0,1),0,1e-6);
eq(Geo.distSegNM(0.1,0.5,0,0,0,1),6,0.01);      // 0.1 deg lat = 6 NM
eq(Geo.distSegNM(0,2,0,0,0,1),60,0.01);          // beyond the end: 1 deg lon at equator
eq(Geo.distSegNM(60,0,60,1,60,2),30,0.01);       // 1 deg lon at 60N = 30 NM
eq(Geo.gcNM(0,0,1,0),60.04,0.1);
var enc=[1000,4000,50,0,0,-50];var dd=Geo.decode(enc);eq(dd[0],10);eq(dd[1],40);eq(dd[2],10.5);eq(dd[3],40);eq(dd[4],10.5);eq(dd[5],39.5);
console.log('ALL GEO OK');
