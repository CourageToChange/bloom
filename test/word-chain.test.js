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

test("word ladders are deterministic", () => {
  const seed = hashStr("bloom-lib-wordchain-42");
  const a = puzzles.makeWordChain(mulberry32(seed), { difficulty: "deep" }).wordChainModel;
  const b = puzzles.makeWordChain(mulberry32(seed), { difficulty: "deep" }).wordChainModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 word ladders have valid one-letter steps and varied routes", () => {
  const instances = new Set();
  const lengths = new Set();
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-wordchain-${i}`);
    const model = puzzles.makeWordChain(mulberry32(seed), { difficulty: depths[i % 3] }).wordChainModel;
    assert.equal(puzzles.validateWordChain(model), true, `invalid word ladder ${i}`);
    lengths.add(model.chain.length);
    instances.add(model.chain.map((entry) => entry.w).join("-") + ":" + model.stages.map((stage) => stage.choices.join("/")).join("|"));
  }
  assert.deepEqual(Array.from(lengths).sort(), [3, 4, 5]);
  assert.ok(instances.size > 1000, "expected varied routes and choice orders");
});
