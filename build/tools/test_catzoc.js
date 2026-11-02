// CATZOC: the app's depth and position accuracy against the figures printed in IHO S-67 Ed 1.0.0 (Table 4-4 and Annex A Table A-1).
// usage: node build/tools/test_catzoc.js
var fs = require('fs'), path = require('path'), assert = require('assert');
var h = fs.readFileSync(path.resolve(__dirname, '../../Bridge-Calculators.html'), 'utf8');
var CATZOC = new Function(h.slice(h.indexOf('/* CATZOC-BEGIN'), h.indexOf('/* CATZOC-END */')) + '; return CATZOC;')();
var n = 0;
// S-67 Table 4-4: depth accuracy (m) by depth, columns A1 A2 B C
var T44 = { 0: [0.5, 1.0, 1.0, 2.0], 10: [0.6, 1.2, 1.2, 2.5], 20: [0.7, 1.4, 1.4, 3.0], 30: [0.8, 1.6, 1.6, 3.5], 40: [0.9, 1.8, 1.8, 4.0], 50: [1.0, 2.0, 2.0, 4.5], 75: [1.3, 2.5, 2.5, 5.8], 100: [1.5, 3.0, 3.0, 7.0] };
Object.keys(T44).forEach(function (d) { ['A1', 'A2', 'B', 'C'].forEach(function (c, i) { assert.strictEqual(CATZOC.depthAcc(c, +d).toFixed(1), T44[d][i].toFixed(1), c + ' at ' + d + ' m'); n++; }); });
// Annex A examples, including 1000 m
var AA = { A1: { 10: 0.6, 30: 0.8, 100: 1.5, 1000: 10.5 }, A2: { 10: 1.2, 30: 1.6, 100: 3.0, 1000: 21.0 }, B: { 10: 1.2, 30: 1.6, 100: 3.0, 1000: 21.0 }, C: { 10: 2.5, 30: 3.5, 100: 7.0, 1000: 52.0 } };
Object.keys(AA).forEach(function (c) { Object.keys(AA[c]).forEach(function (d) { assert(Math.abs(CATZOC.depthAcc(c, +d) - AA[c][d]) < 1e-9, c + ' ' + d); n++; }); });
// position accuracy: A1 5 m + 5 % depth, A2 20 m, B 50 m, C 500 m; D and U not given
assert.strictEqual(CATZOC.posAcc('A1', 0), 5); assert.strictEqual(CATZOC.posAcc('A1', 100), 10); assert.strictEqual(CATZOC.posAcc('A2', 100), 20); assert.strictEqual(CATZOC.posAcc('B', 30), 50); assert.strictEqual(CATZOC.posAcc('C', 30), 500);
assert.strictEqual(CATZOC.posAcc('D', 30), null); assert.strictEqual(CATZOC.depthAcc('U', 30), null); n += 7;
// table text exactly as S-67 Annex A
var z = CATZOC.get('B'); assert.strictEqual(z.cov, 'Full area search not achieved; uncharted features, hazardous to surface navigation are not expected but may exist.'); assert.strictEqual(CATZOC.list.map(function (x) { return x.c + x.stars; }).join(' '), 'A16 A25 B4 C3 D2 U0'); n += 2;
console.log('CATZOC tests passed: ' + n);
