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

test("shape-fit boards are deterministic", () => {
  const seed = hashStr("bloom-lib-shapefit-42");
  const a = puzzles.makeShapeFit(mulberry32(seed), { difficulty: "standard" }).shapeFitModel;
  const b = puzzles.makeShapeFit(mulberry32(seed), { difficulty: "standard" }).shapeFitModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 shape-fit boards have a complete one-to-one solution and varied layouts", () => {
  const layouts = new Set();
  const counts = new Set();
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-shapefit-${i}`);
    const model = puzzles.makeShapeFit(mulberry32(seed), { difficulty: depths[i % 3] }).shapeFitModel;
    assert.equal(puzzles.validateShapeFit(model), true, `invalid shape-fit board ${i}`);
    counts.add(model.pieces.length);
    layouts.add(model.pieces.map((piece) => `${piece.shape}:${piece.color}:${piece.rotation}`).join("|") + JSON.stringify(model.slots));
  }
  assert.deepEqual(Array.from(counts).sort((a, b) => a - b), [4, 5, 6]);
  assert.ok(layouts.size > 2000, "expected varied pieces, colours, and positions");
});
