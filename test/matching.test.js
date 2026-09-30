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

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("matching boards are deterministic", () => {
  const seed = hashStr("bloom-lib-matching-42");
  const a = puzzles.makeMatching(mulberry32(seed), { difficulty: "standard" }).matchingModel;
  const b = puzzles.makeMatching(mulberry32(seed), { difficulty: "standard" }).matchingModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 matching boards are fully paired and varied", () => {
  const layouts = new Set();
  const pairCounts = new Set();
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-matching-${i}`);
    const model = puzzles.makeMatching(mulberry32(seed), { difficulty: depths[i % depths.length] }).matchingModel;
    assert.equal(puzzles.validateMatching(model), true, `invalid matching board ${i}`);
    pairCounts.add(model.pairCount);
    layouts.add(model.tiles.map((tile) => tile.glyph).join(""));
  }
  assert.deepEqual(Array.from(pairCounts).sort((a, b) => a - b), [6, 8, 10]);
  assert.ok(layouts.size > 2000, "expected broad matching-board variety");
});
