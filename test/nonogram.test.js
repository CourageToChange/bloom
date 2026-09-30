"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "public", "puzzles.js"), "utf8");
const context = { window: {}, setTimeout, clearTimeout };
vm.runInNewContext(source, context);
const puzzles = context.window.BloomPuzzles;
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i += 1) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("Picross boards are deterministic", () => {
  const seed = hashStr("bloom-lib-nonogram-42");
  const a = puzzles.makeNonogram(mulberry32(seed), {}).nonogramModel;
  const b = puzzles.makeNonogram(mulberry32(seed), {}).nonogramModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 Picross boards have exactly one clue solution and varied pictures", () => {
  const pictures = new Set();
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-nonogram-${i}`);
    const model = puzzles.makeNonogram(mulberry32(seed), {}).nonogramModel;
    assert.equal(puzzles.validateNonogram(model), true, `invalid Picross board ${i}`);
    assert.equal(puzzles.countNonogramSolutions(model, 2), 1, `non-unique Picross board ${i}`);
    pictures.add(model.solution.join(""));
  }
  assert.ok(pictures.size > 1800, "expected varied unique pictures");
});
