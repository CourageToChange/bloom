"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "puzzles.js"), "utf8");
const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const context = { window: {}, setTimeout, clearTimeout };
vm.runInNewContext(source, context);
const puzzles = context.window.BloomPuzzles;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("guided depth is available in settings and passed into play", () => {
  for (const label of ["Gentle", "Standard", "Deep"]) assert.match(app, new RegExp(`label: "${label}"`));
  assert.match(app, /difficulty: depth/);
  assert.match(app, /depthPicker\(\(\) => renderToday\(\)\)/);
  assert.match(app, /depthPicker\(\(\) => renderMore\(\)\)/);
});

test("new families visibly honour Gentle and Deep", () => {
  const gentleMatch = puzzles.makeMatching(mulberry32(1), { difficulty: "gentle" }).matchingModel;
  const deepMatch = puzzles.makeMatching(mulberry32(1), { difficulty: "deep" }).matchingModel;
  assert.equal(gentleMatch.pairCount, 6);
  assert.equal(deepMatch.pairCount, 10);
  const gentleSearch = puzzles.makeWordSearch(mulberry32(2), { difficulty: "gentle", theme: "botanical" }).wordSearchModel;
  const deepSearch = puzzles.makeWordSearch(mulberry32(2), { difficulty: "deep", theme: "botanical" }).wordSearchModel;
  assert.equal(gentleSearch.size, 6);
  assert.equal(gentleSearch.words.length, 4);
  assert.equal(deepSearch.size, 7);
  assert.equal(deepSearch.words.length, 5);
  assert.equal(puzzles.makeSudoku(mulberry32(3), { difficulty: "gentle" }).sudokuModel.size, 4);
  assert.equal(puzzles.makeSudoku(mulberry32(3), { difficulty: "deep" }).sudokuModel.size, 6);
});
