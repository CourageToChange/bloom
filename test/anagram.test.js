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
  for (let i = 0; i < s.length; i += 1) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
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

test("anagrams are deterministic", () => {
  const seed = hashStr("bloom-lib-anagram-42");
  const a = puzzles.makeAnagram(mulberry32(seed), { theme: "botanical", difficulty: "standard" }).anagramModel;
  const b = puzzles.makeAnagram(mulberry32(seed), { theme: "botanical", difficulty: "standard" }).anagramModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 themed anagrams are valid and varied", () => {
  const instances = new Set();
  const lengths = new Set();
  const themes = ["botanical", "fineart", "cozy"];
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-anagram-${i}`);
    const model = puzzles.makeAnagram(mulberry32(seed), { theme: themes[i % 3], difficulty: depths[i % 3] }).anagramModel;
    assert.equal(puzzles.validateAnagram(model), true, `invalid anagram ${i}`);
    instances.add(model.target + ":" + model.scrambled.join(""));
    lengths.add(model.target.length);
  }
  assert.ok(instances.size > 500, "expected varied targets and letter orders");
  assert.ok(lengths.size >= 4, "expected a range of word lengths");
});
