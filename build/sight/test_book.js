// Figures from "Principles of Navigation" (Joseph and Rewari), chapter 11, taken from the 1976 Nautical Almanac.
// The engine is built for 2000-2060 (TT-UTC 69.184 s); in 1976 it was about 47 s, which moves the Moon about 0.2'. Tolerances allow for that.
const fs = require('fs'), S = new Function(fs.readFileSync(__dirname + '/engine.js', 'utf8') + 'return Sight;')();
const t = (y, mo, d, h) => Date.UTC(y, mo - 1, d, h, 0, 0); let bad = 0, n = 0;
const check = (label, app, book, tol) => { n++; const d = ((app - book + 540) % 360 - 180) * 60; if (Math.abs(d) > tol) { bad++; console.log('FAIL', label, d.toFixed(2)); } else console.log(label.padEnd(36), 'diff', d.toFixed(2) + "'"); };
check('Sun GHA 13 Oct 1976 07h (p.175)', S.place(t(1976, 10, 13, 7), 'Sun').gha, 288 + 26.4 / 60, 0.15);
check('Jupiter GHA 12 Oct 1976 22h (p.177)', S.place(t(1976, 10, 12, 22), 'Jupiter').gha, 293 + 11.6 / 60, 0.15);
check('Jupiter GHA 14 Oct 1976 21h (p.181)', S.place(t(1976, 10, 14, 21), 'Jupiter').gha, 280 + 16.9 / 60, 0.15);
check('Moon GHA 13 Oct 1976 14h (p.178)', S.place(t(1976, 10, 13, 14), 'Moon').gha, 154 + 11.2 / 60, 0.3);
const aries = ms => { const s = S.starPlace(ms, 'Schedar'); return s.gha - s.sha; };
check('GHA Aries 14 Oct 1976 14h (p.176)', aries(t(1976, 10, 14, 14)), 233 + 14.4 / 60, 0.15);
// p.181 prints 278 21.2 for 17h, but its own subtraction (287 18.6 - x = 8 56.8) needs 278 21.8: a misprint in the book
check('GHA Aries 14 Oct 1976 17h (p.181)', aries(t(1976, 10, 14, 17)), 278 + 21.8 / 60, 0.15);
check('SHA Schedar Oct 1976 (p.181)', S.starPlace(t(1976, 10, 14, 12), 'Schedar').sha, 350 + 11.4 / 60, 0.15);
check('SHA Betelgeuse Oct 1976 (p.176)', S.starPlace(t(1976, 10, 14, 12), 'Betelgeuse').sha, 271 + 31 / 60, 0.5);
console.log(bad ? 'FAILED ' + bad : 'book tests passed: ' + n); process.exit(bad ? 1 : 0);
