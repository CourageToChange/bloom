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
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("word searches are deterministic for a library seed", () => {
  const seed = hashStr("bloom-lib-wordsearch-42");
  const first = puzzles.makeWordSearch(mulberry32(seed), { theme: "botanical" }).wordSearchModel;
  const second = puzzles.makeWordSearch(mulberry32(seed), { theme: "botanical" }).wordSearchModel;
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("a reversed duplicate on another line is rejected", () => {
  const grid = Array.from({ length: 6 }, () => new Array(6).fill("X"));
  "BLOOM".split("").forEach((letter, col) => { grid[0][col] = letter; });
  "MOOLB".split("").forEach((letter, col) => { grid[1][col] = letter; });
  const cells = "BLOOM".split("").map((_letter, col) => ({ row: 0, col }));

  assert.equal(puzzles.validateWordSearch({
    theme: "botanical",
    size: 6,
    grid,
    words: ["BLOOM"],
    placements: [{ word: "BLOOM", cells }]
  }), false);
});

test("2,100 generated word searches are valid and varied", () => {
  const sizes = new Set();
  const densities = new Set();
  const layouts = new Set();
  const themes = ["botanical", "fineart", "cozy"];

  for (let i = 0; i < 2100; i += 1) {
    const family = "wordsearch";
    const seed = hashStr(`bloom-lib-${family}-${i}`);
    const model = puzzles.makeWordSearch(mulberry32(seed), { theme: themes[i % themes.length] }).wordSearchModel;
    assert.equal(puzzles.validateWordSearch(model), true, `invalid word search at seed ${i}`);
    sizes.add(model.size);
    densities.add(model.words.length);
    layouts.add(model.grid.map((row) => row.join("")).join("/"));
  }

  assert.deepEqual(Array.from(sizes).sort(), [6, 7]);
  assert.deepEqual(Array.from(densities).sort(), [4, 5]);
  assert.ok(layouts.size > 2050, "expected broad layout variety");
});
