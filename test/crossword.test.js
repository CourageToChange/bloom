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

test("crossword-lite boards are deterministic", () => {
  const seed = hashStr("bloom-lib-crossword-42");
  const a = puzzles.makeCrosswordLite(mulberry32(seed), { theme: "fineart", difficulty: "standard" }).crosswordModel;
  const b = puzzles.makeCrosswordLite(mulberry32(seed), { theme: "fineart", difficulty: "standard" }).crosswordModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 crossword-lite boards have one valid crossing and broad variety", () => {
  const instances = new Set();
  const themes = ["botanical", "fineart", "cozy"];
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-crossword-${i}`);
    const model = puzzles.makeCrosswordLite(mulberry32(seed), { theme: themes[i % 3], difficulty: depths[i % 3] }).crosswordModel;
    assert.equal(puzzles.validateCrosswordLite(model), true, `invalid crossword ${i}`);
    instances.add(model.entries.map((entry) => `${entry.word}@${entry.crossIndex}`).join("/") + ":" + model.choices.join("-"));
  }
  assert.ok(instances.size > 500, "expected varied word pairs, crossings, and bank order");
});
