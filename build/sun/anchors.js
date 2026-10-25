var fs=require('fs');var src=fs.readFileSync('calc.js','utf8');eval(src.replace('var SunTimes =','global.SunTimes ='));
function hm(ms,z){var d=new Date(ms+z*3600000);return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2)+':'+('0'+d.getUTCSeconds()).slice(-2)}
function show(name,y,m,d,z,lat,lon,h){var r=SunTimes.solve(y,m,d,z,lat,lon,h||0);var L=r.levels;console.log(name,'rise',L.sun.rise.map(t=>hm(t,z)),'set',L.sun.set.map(t=>hm(t,z)),'LAN',r.transit.map(t=>hm(t,z)),'state',L.sun.state,'civil',L.civil.state,'naut',L.nautical.state,'astro',L.astro.state)}
show('London 2024-06-21 BST(+1)',2024,6,21,1,51.5072,-0.1276);
show('Singapore 2024-01-01 (+8)',2024,1,1,8,1.3521,103.8198);
show('Greenwich equinox 2024-03-20 (0)',2024,3,20,0,51.4779,0);
show('Tromso 2024-06-21 midnight sun (+2)',2024,6,21,2,69.6492,18.9553);
show('Tromso 2024-12-21 polar night (+1)',2024,12,21,1,69.6492,18.9553);
show('Equator 0,0 2024-03-20',2024,3,20,0,0,0);
show('Sydney 2024-12-21 (+11)',2024,12,21,11,-33.8688,151.2093);
show('Mumbai 2026-10-25 (+5.5)',2026,10,25,5.5,18.9220,72.8347);
show('Dateline: Fiji 2026-10-25 (+12)',2026,10,25,12,-18.14,178.44);
show('Mid-Pacific lon 179.9W zone -12',2026,10,25,-12,10,-179.9);
show('Lat 66.5 N 2026-06-21 (0) ',2026,6,21,0,66.5,0);
show('London with height of eye 20 m',2024,6,21,1,51.5072,-0.1276,20);
