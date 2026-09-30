"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "public", "puzzles.js"), "utf8");
const context = { window: { BloomArt: { byIndex: () => ({ svg: "<svg></svg>" }), dataUri: () => "data:image/svg+xml,test" } }, setTimeout, clearTimeout };
vm.runInNewContext(source, context);
const puzzles = context.window.BloomPuzzles;
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i += 1) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("spot-the-difference maps are deterministic", () => {
  const seed = hashStr("bloom-lib-spot-42");
  const a = puzzles.makeSpotDifference(mulberry32(seed), { difficulty: "standard" }).spotModel;
  const b = puzzles.makeSpotDifference(mulberry32(seed), { difficulty: "standard" }).spotModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 difference maps have exact, unambiguous cells and varied changes", () => {
  const instances = new Set();
  const counts = new Set();
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-spot-${i}`);
    const model = puzzles.makeSpotDifference(mulberry32(seed), { difficulty: depths[i % 3] }).spotModel;
    assert.equal(puzzles.validateSpotDifference(model), true, `invalid difference map ${i}`);
    counts.add(model.differences.length);
    instances.add(model.markers.map((marker) => `${marker.index}${marker.glyph}${marker.color}`).join("|"));
  }
  assert.deepEqual(Array.from(counts).sort(), [2, 3, 4]);
  assert.ok(instances.size > 1800, "expected varied difference placement and marks");
});
